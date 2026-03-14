module prometheus::challenge {
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::event;
    use aptos_framework::timestamp;
    use std::signer;
    use std::vector;
    use aptos_std::table::{Self, Table};
    use prometheus::document;

    // ─── Errors ───────────────────────────────────────────
    const E_CHALLENGE_NOT_FOUND:   u64 = 200;
    const E_CHALLENGE_EXPIRED:     u64 = 201;
    const E_CHALLENGE_NOT_EXPIRED: u64 = 202;
    const E_INSUFFICIENT_STAKE:    u64 = 203;
    const E_ALREADY_VOTED:         u64 = 204;
    const E_DOCUMENT_NOT_ACTIVE:   u64 = 205;
    const E_CHALLENGE_RESOLVED:    u64 = 206;
    const E_NOT_CHALLENGER:        u64 = 207;

    // ─── Constants ────────────────────────────────────────
    // Min stake to open a challenge (0.2 APT)
    const MIN_CHALLENGE_STAKE: u64 = 20_000_000;
    // Min stake to vote (0.01 APT)
    const MIN_VOTE_STAKE:      u64 = 1_000_000;
    // Voting window: 72 hours in seconds
    const VOTE_DURATION_SECS:  u64 = 259_200;

    // Challenge outcome
    const OUTCOME_PENDING: u8 = 0;
    const OUTCOME_UPHELD:  u8 = 1; // challenge won → doc removed, guardians slashed
    const OUTCOME_REJECTED: u8 = 2; // challenge lost → challenger slashed

    // ─── Structs ──────────────────────────────────────────
    struct Vote has store, drop, copy {
        voter:        address,
        stake:        u64,
        supports_doc: bool, // true = doc is real, false = doc is fake
        voted_at:     u64,
    }

    struct Challenge has store {
        id:           u64,
        doc_id:       u64,
        challenger:   address,
        stake:        u64,
        reason:       std::string::String,
        votes:        vector<Vote>,
        votes_for_doc:    u64, // APT staked "doc is real"
        votes_against_doc: u64, // APT staked "doc is fake"
        outcome:      u8,
        created_at:   u64,
        deadline:     u64,
    }

    struct ChallengeRegistry has key {
        challenges:   Table<u64, Challenge>,
        next_id:      u64,
        registry_addr: address, // document registry address
    }

    // ─── Events ───────────────────────────────────────────
    #[event]
    struct ChallengeOpened has drop, store {
        challenge_id: u64,
        doc_id:       u64,
        challenger:   address,
        stake:        u64,
        deadline:     u64,
    }

    #[event]
    struct VoteCast has drop, store {
        challenge_id:  u64,
        voter:         address,
        stake:         u64,
        supports_doc:  bool,
    }

    #[event]
    struct ChallengeResolved has drop, store {
        challenge_id:      u64,
        doc_id:            u64,
        outcome:           u8,
        votes_for_doc:     u64,
        votes_against_doc: u64,
    }

    // ─── Initialize ───────────────────────────────────────
    public fun initialize(admin: &signer, registry_addr: address) {
        move_to(admin, ChallengeRegistry {
            challenges:    table::new(),
            next_id:       1,
            registry_addr,
        });
    }

    // ─── Open challenge ───────────────────────────────────
    public entry fun open_challenge(
        challenger:    &signer,
        challenge_reg: address,
        doc_id:        u64,
        stake_amount:  u64,
        reason:        std::string::String,
    ) acquires ChallengeRegistry {
        assert!(stake_amount >= MIN_CHALLENGE_STAKE, E_INSUFFICIENT_STAKE);

        let challenger_addr = signer::address_of(challenger);

        // Verify doc is active
        let reg = borrow_global<ChallengeRegistry>(challenge_reg);
        let doc_status = document::get_doc_status(reg.registry_addr, doc_id);
        assert!(doc_status == document::status_active(), E_DOCUMENT_NOT_ACTIVE);

        // Pull stake
        coin::transfer<AptosCoin>(challenger, challenge_reg, stake_amount);

        let reg = borrow_global_mut<ChallengeRegistry>(challenge_reg);
        let challenge_id = reg.next_id;
        let now = timestamp::now_seconds();
        let deadline = now + VOTE_DURATION_SECS;

        table::add(&mut reg.challenges, challenge_id, Challenge {
            id: challenge_id,
            doc_id,
            challenger: challenger_addr,
            stake: stake_amount,
            reason,
            votes: vector::empty(),
            votes_for_doc: 0,
            votes_against_doc: 0,
            outcome: OUTCOME_PENDING,
            created_at: now,
            deadline,
        });

        reg.next_id = challenge_id + 1;

        // Mark document as challenged
        document::set_status(reg.registry_addr, doc_id, document::status_challenged());

        event::emit(ChallengeOpened {
            challenge_id,
            doc_id,
            challenger: challenger_addr,
            stake: stake_amount,
            deadline,
        });
    }

    // ─── Vote ─────────────────────────────────────────────
    public entry fun vote(
        voter:         &signer,
        challenge_reg: address,
        challenge_id:  u64,
        stake_amount:  u64,
        supports_doc:  bool,  // true = "this doc is real", false = "it's fake"
    ) acquires ChallengeRegistry {
        assert!(stake_amount >= MIN_VOTE_STAKE, E_INSUFFICIENT_STAKE);

        let voter_addr = signer::address_of(voter);
        let now = timestamp::now_seconds();

        let reg = borrow_global_mut<ChallengeRegistry>(challenge_reg);
        assert!(table::contains(&reg.challenges, challenge_id), E_CHALLENGE_NOT_FOUND);

        let challenge = table::borrow_mut(&mut reg.challenges, challenge_id);
        assert!(now < challenge.deadline, E_CHALLENGE_EXPIRED);
        assert!(challenge.outcome == OUTCOME_PENDING, E_CHALLENGE_RESOLVED);

        // Check not already voted
        let i = 0;
        let len = vector::length(&challenge.votes);
        while (i < len) {
            let v = vector::borrow(&challenge.votes, i);
            assert!(v.voter != voter_addr, E_ALREADY_VOTED);
            i = i + 1;
        };

        // Pull stake
        coin::transfer<AptosCoin>(voter, challenge_reg, stake_amount);

        // Tally
        if (supports_doc) {
            challenge.votes_for_doc = challenge.votes_for_doc + stake_amount;
        } else {
            challenge.votes_against_doc = challenge.votes_against_doc + stake_amount;
        };

        vector::push_back(&mut challenge.votes, Vote {
            voter: voter_addr,
            stake: stake_amount,
            supports_doc,
            voted_at: now,
        });

        event::emit(VoteCast {
            challenge_id,
            voter: voter_addr,
            stake: stake_amount,
            supports_doc,
        });
    }

    // ─── Resolve (callable after deadline) ────────────────
    // Anyone can call this — permissionless resolution
    public entry fun resolve(
        caller:        &signer,
        challenge_reg: address,
        challenge_id:  u64,
    ) acquires ChallengeRegistry {
        let now = timestamp::now_seconds();
        let reg = borrow_global_mut<ChallengeRegistry>(challenge_reg);

        assert!(table::contains(&reg.challenges, challenge_id), E_CHALLENGE_NOT_FOUND);

        let challenge = table::borrow_mut(&mut reg.challenges, challenge_id);
        assert!(now >= challenge.deadline, E_CHALLENGE_NOT_EXPIRED);
        assert!(challenge.outcome == OUTCOME_PENDING, E_CHALLENGE_RESOLVED);

        let doc_id = challenge.doc_id;
        let votes_for = challenge.votes_for_doc;
        let votes_against = challenge.votes_against_doc;
        let outcome;

        if (votes_against > votes_for) {
            // Challenge WON — doc is fake → remove it
            outcome = OUTCOME_UPHELD;
            document::set_status(reg.registry_addr, doc_id, document::status_removed());
            // Challenger gets their stake back + bonus from losing side
            // (full reward logic handled off-chain / separate entry fn for gas reasons)
        } else {
            // Challenge LOST — doc is real → vindicate it
            outcome = OUTCOME_REJECTED;
            document::set_status(reg.registry_addr, doc_id, document::status_vindicated());
            // Challenger loses stake, distributed to guardians
        };

        challenge.outcome = outcome;

        event::emit(ChallengeResolved {
            challenge_id,
            doc_id,
            outcome,
            votes_for_doc: votes_for,
            votes_against_doc: votes_against,
        });

        let _ = caller; // permissionless — caller identity not needed
    }

    // ─── Views ────────────────────────────────────────────
    #[view]
    public fun get_challenge_outcome(
        challenge_reg: address,
        challenge_id:  u64,
    ): u8 acquires ChallengeRegistry {
        let reg = borrow_global<ChallengeRegistry>(challenge_reg);
        table::borrow(&reg.challenges, challenge_id).outcome
    }

    #[view]
    public fun get_vote_tally(
        challenge_reg: address,
        challenge_id:  u64,
    ): (u64, u64) acquires ChallengeRegistry {
        let reg = borrow_global<ChallengeRegistry>(challenge_reg);
        let c = table::borrow(&reg.challenges, challenge_id);
        (c.votes_for_doc, c.votes_against_doc)
    }

    #[view]
    public fun get_challenge_deadline(
        challenge_reg: address,
        challenge_id:  u64,
    ): u64 acquires ChallengeRegistry {
        let reg = borrow_global<ChallengeRegistry>(challenge_reg);
        table::borrow(&reg.challenges, challenge_id).deadline
    }

    #[view]
    public fun get_total_challenges(challenge_reg: address): u64
    acquires ChallengeRegistry {
        borrow_global<ChallengeRegistry>(challenge_reg).next_id - 1
    }

    #[view] public fun min_challenge_stake(): u64 { MIN_CHALLENGE_STAKE }
    #[view] public fun min_vote_stake():      u64 { MIN_VOTE_STAKE }
    #[view] public fun vote_duration_secs():  u64 { VOTE_DURATION_SECS }
    #[view] public fun outcome_pending():     u8  { OUTCOME_PENDING }
    #[view] public fun outcome_upheld():      u8  { OUTCOME_UPHELD }
    #[view] public fun outcome_rejected():    u8  { OUTCOME_REJECTED }
}
