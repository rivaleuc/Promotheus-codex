module prometheus::document {
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::event;
    use aptos_framework::timestamp;
    use std::signer;
    use std::string::String;
    use std::vector;
    use aptos_std::table::{Self, Table};

    // Allow challenge module to call set_status
    friend prometheus::challenge;

    // ─── Errors ───────────────────────────────────────────
    const E_DOCUMENT_NOT_FOUND:    u64 = 100;
    const E_INSUFFICIENT_STAKE:    u64 = 101;
    const E_DOCUMENT_NOT_ACTIVE:   u64 = 102;
    const E_ALREADY_GUARDIAN:      u64 = 103;
    const E_NOT_GUARDIAN:          u64 = 104;
    const E_UNAUTHORIZED:          u64 = 105;

    // ─── Constants ────────────────────────────────────────
    // Minimum stake to publish (0.1 APT = 10_000_000 octas)
    const MIN_PUBLISH_STAKE: u64 = 10_000_000;
    // Minimum stake to become guardian (0.05 APT)
    const MIN_GUARDIAN_STAKE: u64 = 5_000_000;
    // Read fee paid to guardians (0.001 APT)
    const READ_FEE: u64 = 100_000;

    // ─── Status ───────────────────────────────────────────
    const STATUS_ACTIVE:     u8 = 0;
    const STATUS_CHALLENGED: u8 = 1;
    const STATUS_REMOVED:    u8 = 2; // lost challenge
    const STATUS_VINDICATED: u8 = 3; // won challenge

    // ─── Structs ──────────────────────────────────────────
    struct Guardian has store, drop, copy {
        addr:         address,
        stake_amount: u64,
        joined_at:    u64,
        rewards_earned: u64,
    }

    struct Document has store {
        id:           u64,
        uploader:     address,
        // Shelby blob reference
        shelby_account:   String,  // Shelby account address that owns the blob
        shelby_blob_name: String,  // path/to/blob.ext on Shelby
        // Metadata
        title:        String,
        description:  String,
        sha256_hash:  String,      // client-side hash for integrity
        // Economics
        uploader_stake:   u64,
        total_staked:     u64,
        read_count:       u64,
        // Status
        status:       u8,
        published_at: u64,
        // Guardians
        guardians:    vector<Guardian>,
    }

    // ─── Global registry ──────────────────────────────────
    struct DocumentRegistry has key {
        documents:   Table<u64, Document>,
        next_id:     u64,
        total_docs:  u64,
    }

    // ─── Events ───────────────────────────────────────────
    #[event]
    struct DocumentPublished has drop, store {
        doc_id:           u64,
        uploader:         address,
        shelby_blob_name: String,
        stake_amount:     u64,
        published_at:     u64,
    }

    #[event]
    struct GuardianJoined has drop, store {
        doc_id:  u64,
        guardian: address,
        stake:   u64,
    }

    #[event]
    struct DocumentRead has drop, store {
        doc_id: u64,
        reader: address,
    }

    #[event]
    struct DocumentStatusChanged has drop, store {
        doc_id:     u64,
        old_status: u8,
        new_status: u8,
    }

    // ─── Initialize ───────────────────────────────────────
    public fun initialize(admin: &signer) {
        move_to(admin, DocumentRegistry {
            documents:  table::new(),
            next_id:    1,
            total_docs: 0,
        });
    }

    // ─── Publish ──────────────────────────────────────────
    public entry fun publish(
        uploader:         &signer,
        registry_addr:    address,
        shelby_account:   String,
        shelby_blob_name: String,
        title:            String,
        description:      String,
        sha256_hash:      String,
        stake_amount:     u64,
    ) acquires DocumentRegistry {
        assert!(stake_amount >= MIN_PUBLISH_STAKE, E_INSUFFICIENT_STAKE);

        let uploader_addr = signer::address_of(uploader);

        // Pull stake
        coin::transfer<AptosCoin>(uploader, registry_addr, stake_amount);

        let registry = borrow_global_mut<DocumentRegistry>(registry_addr);
        let doc_id = registry.next_id;
        let now = timestamp::now_seconds();

        let doc = Document {
            id: doc_id,
            uploader: uploader_addr,
            shelby_account,
            shelby_blob_name,
            title,
            description,
            sha256_hash,
            uploader_stake: stake_amount,
            total_staked: stake_amount,
            read_count: 0,
            status: STATUS_ACTIVE,
            published_at: now,
            guardians: vector::empty(),
        };

        table::add(&mut registry.documents, doc_id, doc);
        registry.next_id = doc_id + 1;
        registry.total_docs = registry.total_docs + 1;

        event::emit(DocumentPublished {
            doc_id,
            uploader: uploader_addr,
            shelby_blob_name,
            stake_amount,
            published_at: now,
        });
    }

    // ─── Become guardian ──────────────────────────────────
    public entry fun become_guardian(
        guardian_signer: &signer,
        registry_addr:   address,
        doc_id:          u64,
        stake_amount:    u64,
    ) acquires DocumentRegistry {
        assert!(stake_amount >= MIN_GUARDIAN_STAKE, E_INSUFFICIENT_STAKE);

        let guardian_addr = signer::address_of(guardian_signer);
        let registry = borrow_global_mut<DocumentRegistry>(registry_addr);

        assert!(table::contains(&registry.documents, doc_id), E_DOCUMENT_NOT_FOUND);

        let doc = table::borrow_mut(&mut registry.documents, doc_id);
        assert!(doc.status == STATUS_ACTIVE, E_DOCUMENT_NOT_ACTIVE);

        // Check not already guardian
        let i = 0;
        let len = vector::length(&doc.guardians);
        while (i < len) {
            let g = vector::borrow(&doc.guardians, i);
            assert!(g.addr != guardian_addr, E_ALREADY_GUARDIAN);
            i = i + 1;
        };

        // Pull stake
        coin::transfer<AptosCoin>(guardian_signer, registry_addr, stake_amount);

        vector::push_back(&mut doc.guardians, Guardian {
            addr: guardian_addr,
            stake_amount,
            joined_at: timestamp::now_seconds(),
            rewards_earned: 0,
        });

        doc.total_staked = doc.total_staked + stake_amount;

        event::emit(GuardianJoined {
            doc_id,
            guardian: guardian_addr,
            stake: stake_amount,
        });
    }

    // ─── Record read (called by backend after serving file) ─
    public entry fun record_read(
        reader:       &signer,
        registry_addr: address,
        doc_id:       u64,
    ) acquires DocumentRegistry {
        let registry = borrow_global_mut<DocumentRegistry>(registry_addr);
        assert!(table::contains(&registry.documents, doc_id), E_DOCUMENT_NOT_FOUND);

        let doc = table::borrow_mut(&mut registry.documents, doc_id);
        assert!(doc.status == STATUS_ACTIVE || doc.status == STATUS_VINDICATED, E_DOCUMENT_NOT_ACTIVE);

        doc.read_count = doc.read_count + 1;

        event::emit(DocumentRead {
            doc_id,
            reader: signer::address_of(reader),
        });
    }

    // ─── Internal: change status (called by challenge module) ─
    public(friend) fun set_status(
        registry_addr: address,
        doc_id:        u64,
        new_status:    u8,
    ) acquires DocumentRegistry {
        let registry = borrow_global_mut<DocumentRegistry>(registry_addr);
        let doc = table::borrow_mut(&mut registry.documents, doc_id);
        let old = doc.status;
        doc.status = new_status;

        event::emit(DocumentStatusChanged {
            doc_id,
            old_status: old,
            new_status,
        });
    }

    // ─── Views ────────────────────────────────────────────
    #[view]
    public fun get_doc_status(registry_addr: address, doc_id: u64): u8
    acquires DocumentRegistry {
        let registry = borrow_global<DocumentRegistry>(registry_addr);
        table::borrow(&registry.documents, doc_id).status
    }

    #[view]
    public fun get_doc_read_count(registry_addr: address, doc_id: u64): u64
    acquires DocumentRegistry {
        let registry = borrow_global<DocumentRegistry>(registry_addr);
        table::borrow(&registry.documents, doc_id).read_count
    }

    #[view]
    public fun get_total_staked_on_doc(registry_addr: address, doc_id: u64): u64
    acquires DocumentRegistry {
        let registry = borrow_global<DocumentRegistry>(registry_addr);
        table::borrow(&registry.documents, doc_id).total_staked
    }

    #[view]
    public fun get_guardian_count(registry_addr: address, doc_id: u64): u64
    acquires DocumentRegistry {
        let registry = borrow_global<DocumentRegistry>(registry_addr);
        let doc = table::borrow(&registry.documents, doc_id);
        vector::length(&doc.guardians)
    }

    #[view]
    public fun get_total_docs(registry_addr: address): u64
    acquires DocumentRegistry {
        borrow_global<DocumentRegistry>(registry_addr).total_docs
    }

    #[view]
    public fun get_next_doc_id(registry_addr: address): u64
    acquires DocumentRegistry {
        borrow_global<DocumentRegistry>(registry_addr).next_id
    }

    // Status constants as views
    #[view] public fun status_active():     u8 { STATUS_ACTIVE }
    #[view] public fun status_challenged(): u8 { STATUS_CHALLENGED }
    #[view] public fun status_removed():    u8 { STATUS_REMOVED }
    #[view] public fun status_vindicated(): u8 { STATUS_VINDICATED }

    #[view] public fun min_publish_stake(): u64 { MIN_PUBLISH_STAKE }
    #[view] public fun min_guardian_stake(): u64 { MIN_GUARDIAN_STAKE }
    #[view] public fun read_fee(): u64 { READ_FEE }
}
