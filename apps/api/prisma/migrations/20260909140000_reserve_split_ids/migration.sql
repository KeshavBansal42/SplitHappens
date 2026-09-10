-- The SplitEscrow on Arc testnet is shared and already has low split ids
-- taken from earlier runs (id 1 is registered and released). A fresh db
-- starts its sequence at 1, so the first openSplit would revert with
-- "splitId already used". Start well above anything used so far.
SELECT setval(pg_get_serial_sequence('splits', 'id'), 999, true);
