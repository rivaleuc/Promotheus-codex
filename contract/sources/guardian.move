module prometheus::guardian {
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::event;
    use std::signer;
    use aptos_std::table::{Self, Table};

    // ─── Errors ───────────────────────────────────────────
    const E_NO_REWARDS:          u64 = 300;
    const E_POSITION_NOT_FOUND:  u64 = 301;
    const E_UNAUTHORIZED:        u64 = 302;

    // ─── Structs ──────────────────────────────────────────
    // Per-guardian position across all docs
    struct GuardianPosition has store, drop, copy {
        doc_id:         u64,
        stake:          u64,
        pending_reward: u64,
        total_claimed:  u64,
    }

    struct GuardianProfile has key {
        positions:     Table<u64, GuardianPosition>, // doc_id → position
        total_staked:  u64,
        total_earned:  u64,
    }

    // ─── Events ───────────────────────────────────────────
    #[event]
    struct RewardClaimed has drop, store {
        guardian: address,
        doc_id:   u64,
        amount:   u64,
    }

    #[event]
    struct RewardAccrued has drop, store {
        guardian: address,
        doc_id:   u64,
        amount:   u64,
    }

    // ─── Initialize profile (each guardian calls once) ────
    public entry fun init_profile(guardian: &signer) {
        if (!exists<GuardianProfile>(signer::address_of(guardian))) {
            move_to(guardian, GuardianProfile {
                positions:    table::new(),
                total_staked: 0,
                total_earned: 0,
            });
        }
    }

    // ─── Accrue reward (called by backend per read) ───────
    // Backend distributes READ_FEE proportionally to guardians
    public entry fun accrue_reward(
        payer:         &signer,     // server wallet
        guardian_addr: address,
        doc_id:        u64,
        amount:        u64,
    ) acquires GuardianProfile {
        if (!exists<GuardianProfile>(guardian_addr)) return;

        let profile = borrow_global_mut<GuardianProfile>(guardian_addr);
        if (!table::contains(&profile.positions, doc_id)) return;

        let pos = table::borrow_mut(&mut profile.positions, doc_id);
        pos.pending_reward = pos.pending_reward + amount;

        // Transfer from server wallet to guardian directly
        coin::transfer<AptosCoin>(payer, guardian_addr, amount);

        profile.total_earned = profile.total_earned + amount;

        event::emit(RewardAccrued {
            guardian: guardian_addr,
            doc_id,
            amount,
        });
    }

    // ─── Register position (called when becoming guardian) ─
    public fun register_position(
        guardian_addr: address,
        doc_id:        u64,
        stake:         u64,
    ) acquires GuardianProfile {
        if (!exists<GuardianProfile>(guardian_addr)) return;

        let profile = borrow_global_mut<GuardianProfile>(guardian_addr);
        if (!table::contains(&profile.positions, doc_id)) {
            table::add(&mut profile.positions, doc_id, GuardianPosition {
                doc_id,
                stake,
                pending_reward: 0,
                total_claimed:  0,
            });
        };
        profile.total_staked = profile.total_staked + stake;
    }

    // ─── Views ────────────────────────────────────────────
    #[view]
    public fun get_pending_reward(guardian_addr: address, doc_id: u64): u64
    acquires GuardianProfile {
        if (!exists<GuardianProfile>(guardian_addr)) return 0;
        let profile = borrow_global<GuardianProfile>(guardian_addr);
        if (!table::contains(&profile.positions, doc_id)) return 0;
        table::borrow(&profile.positions, doc_id).pending_reward
    }

    #[view]
    public fun get_total_earned(guardian_addr: address): u64
    acquires GuardianProfile {
        if (!exists<GuardianProfile>(guardian_addr)) return 0;
        borrow_global<GuardianProfile>(guardian_addr).total_earned
    }

    #[view]
    public fun get_total_staked(guardian_addr: address): u64
    acquires GuardianProfile {
        if (!exists<GuardianProfile>(guardian_addr)) return 0;
        borrow_global<GuardianProfile>(guardian_addr).total_staked
    }
}
