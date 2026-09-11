import initSqlJs from 'sql.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('DatabaseService migrations', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('migration 12 adds token_address columns to UTXOs, addresses, and keys tables', async () => {
    const SQL = await initSqlJs();
    const seed = new SQL.Database();

    seed.run(`
      CREATE TABLE IF NOT EXISTS wallets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wallet_name VARCHAR(255),
        mnemonic TEXT,
        passphrase TEXT,
        networkType TEXT,
        walletType TEXT DEFAULT 'standard',
        balance INT,
        derivation_path TEXT,
        derivation_path_source TEXT DEFAULT 'default',
        kdf_salt TEXT,
        birth_height INT,
        network_cleanup_version INT DEFAULT 0,
        network_cleanup_network TEXT
      );
    `);

    seed.run(`
      CREATE TABLE IF NOT EXISTS keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wallet_id INTEGER,
        public_key BLOB,
        private_key BLOB,
        address VARCHAR(255) UNIQUE,
        pubkey_hash BLOB,
        account_index INT,
        change_index INT,
        address_index INT,
        FOREIGN KEY(wallet_id) REFERENCES wallets(id)
      );
    `);

    seed.run(`
      CREATE TABLE IF NOT EXISTS addresses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wallet_id INT,
        address VARCHAR(255) NOT NULL UNIQUE,
        balance INT,
        hd_index INT,
        change_index BOOLEAN,
        prefix VARCHAR(255),
        FOREIGN KEY(wallet_id) REFERENCES wallets(id)
      );
    `);

    seed.run(`
      CREATE TABLE IF NOT EXISTS UTXOs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wallet_id INT,
        address VARCHAR(255) NOT NULL,
        height INT NOT NULL,
        tx_hash TEXT NOT NULL,
        tx_pos INT NOT NULL,
        amount INT NOT NULL,
        prefix VARCHAR(255) NOT NULL,
        token TEXT,
        contractFunction TEXT,
        contractFunctionInputs TEXT,
        FOREIGN KEY(wallet_id) REFERENCES wallets(id),
        UNIQUE(wallet_id, address, tx_hash, tx_pos)
      );
    `);

    seed.run(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wallet_id INT,
        tx_hash TEXT NOT NULL,
        height INT NOT NULL,
        timestamp TEXT NOT NULL,
        amount INT NOT NULL,
        FOREIGN KEY(wallet_id) REFERENCES wallets(id)
        UNIQUE(wallet_id, tx_hash)
      );
    `);

    seed.run(`
      CREATE TABLE IF NOT EXISTS transaction_details (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wallet_id INT,
        tx_hash TEXT NOT NULL,
        confirmations INT NOT NULL,
        height INT,
        fee_sats INT,
        timestamp TEXT NOT NULL,
        inputs_json TEXT NOT NULL,
        outputs_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(wallet_id) REFERENCES wallets(id),
        UNIQUE(wallet_id, tx_hash)
      );
    `);

    seed.run(`
      CREATE TABLE IF NOT EXISTS cashscript_artifacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contract_name VARCHAR(255) UNIQUE,
        constructor_inputs TEXT,
        abi TEXT,
        bytecode TEXT,
        source TEXT,
        compiler_name VARCHAR(255),
        compiler_version VARCHAR(255),
        updated_at TEXT
      );
    `);

    seed.run(`
      CREATE TABLE IF NOT EXISTS cashscript_addresses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wallet_id INT,
        address VARCHAR(255) NOT NULL UNIQUE,
        artifact_id INT,
        constructor_args TEXT,
        balance INT,
        prefix VARCHAR(255),
        FOREIGN KEY(wallet_id) REFERENCES wallets(id)
      );
    `);

    seed.run(`
      CREATE TABLE IF NOT EXISTS instantiated_contracts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contract_name VARCHAR(255),
        address VARCHAR(255) UNIQUE,
        token_address VARCHAR(255),
        opcount INT,
        bytesize INT,
        bytecode TEXT,
        balance INT,
        utxos TEXT,
        created_at TEXT,
        updated_at TEXT,
        artifact TEXT,
        abi TEXT,
        redeemScript TEXT,
        unlock TEXT
      );
    `);

    seed.run(`
      CREATE TABLE IF NOT EXISTS quantumroot_vaults (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wallet_id INT NOT NULL,
        account_index INT NOT NULL,
        address_index INT NOT NULL,
        receive_address VARCHAR(255) NOT NULL UNIQUE,
        quantum_lock_address VARCHAR(255) NOT NULL UNIQUE,
        receive_locking_bytecode TEXT NOT NULL,
        quantum_lock_locking_bytecode TEXT NOT NULL,
        quantum_public_key TEXT NOT NULL,
        quantum_key_identifier TEXT NOT NULL,
        vault_token_category TEXT NOT NULL,
        online_quantum_signer INT NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(wallet_id) REFERENCES wallets(id),
        UNIQUE(wallet_id, account_index, address_index)
      );
    `);

    seed.run(`
      CREATE TABLE IF NOT EXISTS wallet_special_activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wallet_id INT NOT NULL,
        activity_type TEXT NOT NULL,
        network_type TEXT NOT NULL,
        derivation_path TEXT NOT NULL,
        status TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(wallet_id) REFERENCES wallets(id),
        UNIQUE(wallet_id, activity_type)
      );
    `);

    seed.run(`
      CREATE TABLE IF NOT EXISTS bcmr (
        authbase TEXT PRIMARY KEY,
        registryUri TEXT NOT NULL,
        lastFetch TEXT NOT NULL,
        registryHash TEXT NOT NULL,
        registryData TEXT NOT NULL
      );
    `);

    seed.run(`
      CREATE TABLE IF NOT EXISTS bcmr_tokens (
        category TEXT PRIMARY KEY,
        authbase TEXT NOT NULL,
        FOREIGN KEY(authbase) REFERENCES bcmr(authbase)
      );
    `);

    seed.run(`
      CREATE TABLE IF NOT EXISTS bcmr_metadata (
        category TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        decimals INTEGER NOT NULL,
        symbol TEXT NOT NULL,
        is_nft BOOLEAN NOT NULL,
        nfts TEXT,
        uris TEXT,
        extensions TEXT,
        lastFetch TEXT,
        registryUri TEXT,
        registryHash TEXT,
        FOREIGN KEY(category) REFERENCES bcmr_tokens(category)
      );
    `);

    seed.run(`
      CREATE TABLE IF NOT EXISTS multisig_policies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wallet_id INT NOT NULL UNIQUE,
        schema_version INT NOT NULL DEFAULT 1,
        policy_id TEXT NOT NULL UNIQUE,
        policy_revision INT NOT NULL DEFAULT 0,
        network_type TEXT NOT NULL,
        threshold INT NOT NULL,
        account_path TEXT NOT NULL,
        policy_name TEXT NOT NULL,
        receive_descriptor TEXT,
        change_descriptor TEXT,
        receive_cursor INT NOT NULL DEFAULT 0,
        change_cursor INT NOT NULL DEFAULT 0,
        gap_limit INT NOT NULL DEFAULT 20,
        setup_status TEXT NOT NULL DEFAULT 'ready',
        legacy_policy_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(wallet_id) REFERENCES wallets(id)
      );
    `);

    seed.run(`
      CREATE TABLE IF NOT EXISTS multisig_cosigners (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wallet_id INT NOT NULL,
        policy_revision INT NOT NULL,
        cosigner_id TEXT NOT NULL,
        label TEXT NOT NULL,
        xpub TEXT NOT NULL,
        master_fingerprint TEXT NOT NULL,
        account_path TEXT NOT NULL,
        FOREIGN KEY(wallet_id) REFERENCES wallets(id),
        UNIQUE(wallet_id, policy_revision, cosigner_id),
        UNIQUE(wallet_id, policy_revision, xpub)
      );
    `);

    seed.run(`
      CREATE TABLE IF NOT EXISTS multisig_addresses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wallet_id INT NOT NULL,
        policy_revision INT NOT NULL,
        branch_index INT NOT NULL,
        address_index INT NOT NULL,
        address TEXT NOT NULL,
        token_address TEXT NOT NULL,
        locking_bytecode TEXT NOT NULL,
        redeem_script TEXT NOT NULL,
        reservation_status TEXT NOT NULL DEFAULT 'available',
        reserved_at TEXT,
        used_at TEXT,
        FOREIGN KEY(wallet_id) REFERENCES wallets(id),
        UNIQUE(wallet_id, policy_revision, branch_index, address_index),
        UNIQUE(wallet_id, address)
      );
    `);

    seed.run(`
      CREATE TABLE IF NOT EXISTS multisig_address_keys (
        wallet_id INT NOT NULL,
        address_id INT NOT NULL,
        cosigner_id TEXT NOT NULL,
        public_key TEXT NOT NULL,
        sorted_position INT NOT NULL,
        derivation_path TEXT NOT NULL,
        FOREIGN KEY(wallet_id) REFERENCES wallets(id),
        FOREIGN KEY(address_id) REFERENCES multisig_addresses(id),
        PRIMARY KEY(wallet_id, address_id, cosigner_id),
        UNIQUE(address_id, sorted_position)
      );
    `);

    seed.run(`
      CREATE TABLE IF NOT EXISTS multisig_spend_sessions (
        session_id TEXT PRIMARY KEY,
        wallet_id INT NOT NULL,
        policy_id TEXT NOT NULL,
        unsigned_tx_hash TEXT NOT NULL,
        psbt_bytes BLOB NOT NULL,
        stage TEXT NOT NULL,
        signatures_json TEXT NOT NULL DEFAULT '[]',
        raw_tx_hex TEXT,
        retry_count INT NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(wallet_id) REFERENCES wallets(id),
        UNIQUE(wallet_id, unsigned_tx_hash)
      );
    `);

    seed.run('CREATE INDEX IF NOT EXISTS idx_multisig_addresses_wallet ON multisig_addresses(wallet_id, branch_index, address_index);');
    seed.run('CREATE INDEX IF NOT EXISTS idx_multisig_sessions_wallet ON multisig_spend_sessions(wallet_id, updated_at);');

    seed.run('PRAGMA user_version = 11');

    seed.run(
      `INSERT INTO wallets
        (id, wallet_name, mnemonic, passphrase, networkType, walletType, balance)
       VALUES (1, 'test-wallet', '', '', 'chipnet', 'standard', 0)`
    );
    seed.run(
      `INSERT INTO keys
        (wallet_id, address, pubkey_hash, account_index, change_index, address_index)
       VALUES (1, 'bchtest:qtest', X'01', 0, 0, 0)`
    );
    seed.run(
      `INSERT INTO addresses
        (wallet_id, address, balance, hd_index, change_index, prefix)
       VALUES (1, 'bchtest:qtest', 0, 0, 0, 'bchtest')`
    );
    seed.run(
      `INSERT INTO UTXOs
        (wallet_id, address, height, tx_hash, tx_pos, amount, prefix)
       VALUES (1, 'bchtest:qtest', 100, '${'a'.repeat(64)}', 0, 1000, 'bchtest')`
    );

    let persisted = seed.export();
    seed.close();

    const idbGet = vi.fn(async () => new Uint8Array(persisted));
    const idbSet = vi.fn(async (_key: string, value: Uint8Array) => {
      persisted = new Uint8Array(value);
    });

    vi.doMock('idb-keyval', () => ({
      get: idbGet,
      set: idbSet,
    }));
    vi.doMock('sql.js', () => ({
      default: vi.fn(async () => SQL),
    }));

    const mod = await import('../DatabaseService');
    const svc = mod.default();
    await svc.startDatabase();
    const db = svc.getDatabase()!;

    const utxoResult = db.exec('PRAGMA table_info(UTXOs)');
    const utxoCols = utxoResult[0].values.map(v => v[1]);
    expect(utxoCols).toContain('token_address');

    const addrResult = db.exec('PRAGMA table_info(addresses)');
    const addrCols = addrResult[0].values.map(v => v[1]);
    expect(addrCols).toContain('token_address');

    const keyResult = db.exec('PRAGMA table_info(keys)');
    const keyCols = keyResult[0].values.map(v => v[1]);
    expect(keyCols).toContain('token_address');

    expect(() => {
      db.run(
        `INSERT INTO UTXOs 
          (wallet_id, address, token_address, height, tx_hash, tx_pos, amount, prefix)
         VALUES (1, 'bchtest:qnew', 'bchtest:znew', 200, '${'b'.repeat(64)}', 0, 2000, 'bchtest')`
      );
    }).not.toThrow();

    expect(() => {
      db.run(
        `UPDATE keys SET token_address = 'bchtest:ztest' WHERE wallet_id = 1`
      );
    }).not.toThrow();

    expect(() => {
      db.run(
        `UPDATE addresses SET token_address = 'bchtest:zaddr' WHERE wallet_id = 1`
      );
    }).not.toThrow();

    const selectResult = db.exec(
      `SELECT address, token_address FROM UTXOs WHERE wallet_id = 1 ORDER BY height`
    );
    expect(selectResult[0].values).toEqual([
      ['bchtest:qtest', null],
      ['bchtest:qnew', 'bchtest:znew'],
    ]);

    const version = db.exec('PRAGMA user_version')[0].values[0][0];
    expect(version).toBe(12);
  });

  it('migration 12 is idempotent when columns already exist', async () => {
    vi.resetModules();

    const SQL = await initSqlJs();
    const seed = new SQL.Database();

    const { createTables, createMultisigTables } = await import(
      '../../../utils/schema/schema'
    );
    createTables(seed);
    createMultisigTables(seed);
    seed.run('PRAGMA user_version = 11');

    let persisted = seed.export();
    seed.close();

    const idbGet = vi.fn(async () => new Uint8Array(persisted));
    const idbSet = vi.fn(async (_key: string, value: Uint8Array) => {
      persisted = new Uint8Array(value);
    });

    vi.doMock('idb-keyval', () => ({
      get: idbGet,
      set: idbSet,
    }));
    vi.doMock('sql.js', () => ({
      default: vi.fn(async () => SQL),
    }));

    const mod = await import('../DatabaseService');
    const svc = mod.default();

    await svc.startDatabase();

    const db = svc.getDatabase()!;
    expect(db).not.toBeNull();
    const version = db.exec('PRAGMA user_version')[0].values[0][0];
    expect(version).toBe(12);
  });
});
