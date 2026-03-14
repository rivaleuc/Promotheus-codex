module prometheus::treasury {
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::account;
    use aptos_framework::event;
    use std::signer;

    // ─── Errors ───────────────────────────────────────────
    const E_INSUFFICIENT_BALANCE: u64 = 1;
    const E_NOT_AUTHORIZED:       u64 = 2;

    // ─── Events ───────────────────────────────────────────
    #[event]
    struct StakeEvent has drop, store {
        staker:  address,
        amount:  u64,
        doc_id:  u64,
    }

    #[event]
    struct RewardEvent has drop, store {
        recipient: address,
        amount:    u64,
        doc_id:    u64,
    }

    #[event]
    struct SlashEvent has drop, store {
        slashed: address,
        amount:  u64,
        doc_id:  u64,
    }

    // ─── Treasury resource (held by deployer) ─────────────
    struct Treasury has key {
        total_staked: u64,
        total_slashed: u64,
    }

    // Initialize treasury at deploy time
    public fun initialize(admin: &signer) {
        move_to(admin, Treasury {
            total_staked: 0,
            total_slashed: 0,
        });
    }

    // Pull APT from staker into treasury
    public fun stake(
        staker:  &signer,
        amount:  u64,
        doc_id:  u64,
        treasury_addr: address,
    ) acquires Treasury {
        assert!(
            coin::balance<AptosCoin>(signer::address_of(staker)) >= amount,
            E_INSUFFICIENT_BALANCE
        );

        coin::transfer<AptosCoin>(staker, treasury_addr, amount);

        let treasury = borrow_global_mut<Treasury>(treasury_addr);
        treasury.total_staked = treasury.total_staked + amount;

        event::emit(StakeEvent {
            staker: signer::address_of(staker),
            amount,
            doc_id,
        });
    }

    // Send reward from treasury to recipient
    public fun reward(
        admin:    &signer,
        to:       address,
        amount:   u64,
        doc_id:   u64,
    ) acquires Treasury {
        let admin_addr = signer::address_of(admin);
        assert!(
            coin::balance<AptosCoin>(admin_addr) >= amount,
            E_INSUFFICIENT_BALANCE
        );

        coin::transfer<AptosCoin>(admin, to, amount);

        let treasury = borrow_global_mut<Treasury>(admin_addr);
        treasury.total_staked = if (treasury.total_staked >= amount) {
            treasury.total_staked - amount
        } else { 0 };

        event::emit(RewardEvent { recipient: to, amount, doc_id });
    }

    // Slash stake (move to protocol reserve / burn)
    public fun slash(
        admin:   &signer,
        from:    address,
        amount:  u64,
        doc_id:  u64,
    ) acquires Treasury {
        let admin_addr = signer::address_of(admin);
        let treasury = borrow_global_mut<Treasury>(admin_addr);
        treasury.total_slashed = treasury.total_slashed + amount;

        event::emit(SlashEvent { slashed: from, amount, doc_id });
    }

    // ─── View ─────────────────────────────────────────────
    #[view]
    public fun get_total_staked(treasury_addr: address): u64 acquires Treasury {
        borrow_global<Treasury>(treasury_addr).total_staked
    }

    #[view]
    public fun get_total_slashed(treasury_addr: address): u64 acquires Treasury {
        borrow_global<Treasury>(treasury_addr).total_slashed
    }
}
