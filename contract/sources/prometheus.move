module prometheus::prometheus {
    use std::signer;
    use prometheus::document;
    use prometheus::challenge;
    use prometheus::guardian;
    use prometheus::treasury;

    // ─── Bootstrap (call once after deploy) ───────────────
    // Initializes all sub-modules under the deployer's address
    public entry fun initialize(admin: &signer) {
        let admin_addr = signer::address_of(admin);

        treasury::initialize(admin);
        document::initialize(admin);
        challenge::initialize(admin, admin_addr);
        // Each guardian calls guardian::init_profile() themselves
    }

    // ─── Convenience: publish + auto-init guardian profile ─
    // Single tx: publish doc, optionally init guardian profile
    public entry fun publish_document(
        uploader:         &signer,
        registry_addr:    address,
        shelby_account:   std::string::String,
        shelby_blob_name: std::string::String,
        title:            std::string::String,
        description:      std::string::String,
        sha256_hash:      std::string::String,
        stake_amount:     u64,
    ) {
        // Init guardian profile if needed (so uploader can earn from reads)
        guardian::init_profile(uploader);

        document::publish(
            uploader,
            registry_addr,
            shelby_account,
            shelby_blob_name,
            title,
            description,
            sha256_hash,
            stake_amount,
        );
    }
}
