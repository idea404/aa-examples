# Account Abstraction Examples

This repository contains some examples for AA. Namely these simplified contracts:

- [PensionAccount.sol](./contracts/PensionAccount.sol) - allows to deposit funds which are spread over four different tokens (mocked) and has a lockup period. 
- LockupAccount.sol - allows withdrawing vested ETH after a cliff period and vests pro-rata over the vesting period.
- AppAccount.sol - allows owner to interact freely with a specified contract (e.g. a game contract) and has an expiry period after of which it transfers all funds back to the account that deploys it. 
