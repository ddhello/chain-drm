#![allow(unexpected_cfgs)]
#![allow(deprecated)]

use anchor_lang::prelude::*;

declare_id!("6CTtHe2u4robZvXvP1SbdhKrRvZzYszAurBD7wxMydji");
#[program]
pub mod chain_drm {
    use super::*;

    pub fn create_license(
        ctx: Context<CreateLicense>,
        app_id: u32,
        machine_code_hash: [u8;16]
    )->Result<()>{
        let license = &mut ctx.accounts.app_license;
        license.app_id = app_id;
        license.owner = *ctx.accounts.user.key;
        license.machine_code_hash = machine_code_hash;

        license.bump = ctx.bumps.app_license;

        msg!("Game License Created and bound for User {}",license.owner);
        Ok(())
    }
}

#[account]
pub struct License{
    pub app_id: u32,
    pub owner: Pubkey,
    pub machine_code_hash: [u8;16],
    pub bump: u8
}

#[derive(Accounts)]
#[instruction(app_id:u32)]
pub struct CreateLicense<'info>{
    //Account of software developer
    #[account(mut)]
    pub developer: Signer<'info>,
    
    //Account of user
    /// CHECK:
    #[account(mut)]
    pub user: AccountInfo<'info>,

    //Initialize License PDA Account
    #[account(
        init,
        payer = developer,
        space = 8 + 4 + 32 + 16 + 1,
        seeds = [b"license",user.key().as_ref(),&app_id.to_le_bytes()],
        bump
    )]
    pub app_license: Account<'info,License>,

    pub system_program: Program<'info,System>,
}
