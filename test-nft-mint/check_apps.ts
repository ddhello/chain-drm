import { Connection, PublicKey } from '@solana/web3.js';
import { Program, Idl, BorshAccountsCoder } from '@coral-xyz/anchor';

import idlRaw from '../target/idl/chain_drm.json';
const idl = idlRaw as Idl;

const CONFIG = {
    rpcUrl: "https://api.devnet.solana.com",
    programId: new PublicKey(idl.address),
};

async function main() {
    // 从命令行读取要查询的玩家地址
    const playerWalletAddress = process.argv[2];
    if (!playerWalletAddress) {
        console.error("❌ 错误: 请提供要查询的玩家钱包地址。");
        console.error("用法: npx ts-node query-licenses.ts <PLAYER_WALLET_ADDRESS>");
        process.exit(1);
    }

    let playerPublicKey: PublicKey;
    try {
        playerPublicKey = new PublicKey(playerWalletAddress);
    } catch (e) {
        console.error(`❌ 错误: 无效的钱包地址 "${playerWalletAddress}"`);
        process.exit(1);
    }

    console.log(`🔍 正在为玩家 ${playerPublicKey.toBase58()} 查询所有 DRM 许可证...`);
    
    const connection = new Connection(CONFIG.rpcUrl, 'confirmed');

    try {
        const accounts = await connection.getProgramAccounts(CONFIG.programId, {
            // 这是关键的过滤器配置
            filters: [
                {
                    // 筛选条件1: 账户大小必须匹配我们的 License 结构体大小
                    // 8(disc) + 8(app_id) + 32(owner) + 32(hash) + 1(bump) = 81 字节
                    dataSize: 61,
                },
                {
                    // 筛选条件2: 内存比较 (memcmp)
                    memcmp: {
                        // 从第 16 个字节开始
                        // 8 字节的 discriminator + 8 字节的 app_id = 16
                        offset: 12, 
                        // 要比较的数据，必须是 base58 编码的字符串
                        bytes: playerPublicKey.toBase58(),
                    }
                }
            ]
        });

        if (accounts.length === 0) {
            console.log("\n✅ 查询完成：未找到该玩家的任何许可证。");
            return;
        }

        console.log(`\n✅ 查询完成：共找到 ${accounts.length} 个许可证！`);
        console.log("----------------------------------------");

        // 使用 Anchor 的解码器来解析账户数据
        const accountsCoder = new BorshAccountsCoder(idl);

        for (const account of accounts) {
            const decoded = accountsCoder.decode("License", account.account.data);
            console.log(`  🔹 应用 ID (App ID): ${decoded.app_id.toString()}`);
            console.log(`     所有者 (Owner): ${decoded.owner}`);
            console.log(`     许可证地址 (PDA): ${account.pubkey.toBase58()}`);
            console.log("----------------------------------------");
        }

    } catch (error) {
        console.error("❌ 查询失败:", error);
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});