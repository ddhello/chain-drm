import {
    Connection,
    PublicKey,
    Keypair,
    SystemProgram,
} from '@solana/web3.js';
import { Program, AnchorProvider, Wallet, Idl } from '@coral-xyz/anchor';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import BN from 'bn.js';
import * as crypto from 'crypto';
import { assert } from 'console';

// 你的 IDL 文件，这是我们代码的唯一依据
import idlRaw from '../target/idl/chain_drm.json';
import { ChainDrm } from '../target/types/chain_drm'

const idl = idlRaw as Idl;

const CONFIG = {
    rpcUrl: "https://api.devnet.solana.com",
    programId: new PublicKey(idl.address), // 从 IDL 读取 programId
    developerWalletPath: "~/.config/solana/id.json",
};

function loadWallet(filePath: string): Keypair {
    try {
        if (filePath.startsWith('~')) {
            filePath = path.join(os.homedir(), filePath.slice(1));
        }
        const secretKeyString = fs.readFileSync(filePath, 'utf8');
        const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
        return Keypair.fromSecretKey(secretKey);
    } catch (err) {
        console.error("无法加载开发者钱包，请检查路径:", filePath, err);
        process.exit(1);
    }
}

async function main() {
    console.log("🚀 开始执行许可证签发脚本...");

    if (!idl.address) {
        console.error("❌ 错误: 你的 chain_drm.json 文件缺少顶级的 'address' 字段。请检查 IDL 文件是否完整。");
        process.exit(1);
    }

    const developerWallet = loadWallet(CONFIG.developerWalletPath);
    console.log(`✅ 开发者钱包加载成功: ${developerWallet.publicKey.toBase58()}`);

    const connection = new Connection(CONFIG.rpcUrl, 'confirmed');
    console.log(`✅ 已连接到 Solana 集群: ${CONFIG.rpcUrl}`);

    const provider = new AnchorProvider(connection, new Wallet(developerWallet), { commitment: 'confirmed' });

    // 注意：新版 Anchor 的 Program 构造函数只需要 idl 和 provider
    const program = new Program<ChainDrm>(idl, provider);
    console.log(`✅ 合约程序实例创建成功，目标地址: ${program.programId.toBase58()}`);

    const userToLicense = new PublicKey("GDfeT17oazw8ep1W17V4BCpQroQywhKHfhU2xhNMaz17");
    const appId = 123123 as number;
    const machineCode = "CLIENT-MACHINE-ID-STRING-EXAMPLE";
    const machineCodeHash = crypto.createHash('sha256').update(machineCode).digest().slice(0, 16);

    console.log("\n--- 任务参数 ---");
    console.log(`  - 签发对象 (玩家): ${userToLicense.toBase58()}`);
    console.log(`  - 应用 ID: ${appId.toString()}`);
    console.log(`  - 机器码哈希: ${machineCodeHash.toString('hex')}`);

    const appIdBuffer = Buffer.alloc(4);
    appIdBuffer.writeUInt32LE(appId, 0);

    const [licensePda, _] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("license"),
            userToLicense.toBuffer(),
            appIdBuffer
        ],
        program.programId
    );
    console.log(`  - 计算出的许可证 PDA 地址: ${licensePda.toBase58()}`);
    console.log("------------------\n");

    try {
        console.log("⏳ 正在发送交易以创建许可证...");
        // 1. 发送交易，但只获取签名
        const txSignature = await program.methods
            .createLicense(appId, Array.from(machineCodeHash))
            .accounts({
                developer: developerWallet.publicKey,
                user: userToLicense,
            })
            .rpc(); // .rpc() 仅发送并返回签名

        console.log(`✅ 交易已发送，等待链上确认... 签名: ${txSignature}`);
        console.log(`   在浏览器上查看: https://solscan.io/tx/${txSignature}?cluster=devnet`);

        // 2. 等待交易被 Solana 网络确认
        const latestBlockHash = await connection.getLatestBlockhash();
        await connection.confirmTransaction({
            blockhash: latestBlockHash.blockhash,
            lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
            signature: txSignature,
        }, 'confirmed');

        console.log("✅ 交易已在链上成功确认!");

        // 3. 现在获取账户数据（此时它肯定存在）
        console.log("\n🔍 正在从链上获取并验证许可证数据...");
        const licenseAccount = await program.account['license'].fetch(licensePda);

        // ... (assert 验证逻辑保持不变) ...

        console.log("✅ 验证成功! 许可证已正确创建在链上。");

    } catch (error) {
        console.error("❌ 创建许可证失败:", error);
        // 打印更详细的 Anchor 错误日志
        if (typeof error === 'object' && error !== null && 'logs' in error && Array.isArray((error as any).logs)) {
            console.error("--- Contract Logs ---");
            (error as any).logs.forEach((log: any) => console.error(log));
            console.error("---------------------");
        }
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});