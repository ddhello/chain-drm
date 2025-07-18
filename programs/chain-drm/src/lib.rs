use anchor_lang::prelude::*;

declare_id!("6CTtHe2u4robZvXvP1SbdhKrRvZzYszAurBD7wxMydji");

#[program]
pub mod chain_drm {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
