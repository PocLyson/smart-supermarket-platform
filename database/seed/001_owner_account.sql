-- Owner bootstrap procedure:
-- 1. Generate a one-time BCrypt hash locally, for example:
--      htpasswd -bnBC 12 "" '<one-time-password>' | tr -d ':\n'
-- 2. Replace <OWNER_BCRYPT_HASH> below only in the deployment copy.
-- 3. Run the statement once, sign in, rotate the password, and delete the deployment copy.
-- Never commit the generated hash or plaintext password.

INSERT INTO staff_account (username, password_hash, role, enabled)
VALUES ('owner', '<OWNER_BCRYPT_HASH>', 'OWNER', TRUE);
