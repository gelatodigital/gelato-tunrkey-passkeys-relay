# Turnkey + Gelato Relay Integration Demo

This project demonstrates the integration of **Turnkey** for wallet management and **Gelato Relay** for gasless transactions using `sponsoredCallERC2771`. The frontend is built with **Next.js** and utilizes **Viem** for blockchain interactions.

---

## Features

- **Turnkey Integration**:

  - Create and manage wallets using Turnkey's Passkey API.
  - Secure login and sub-organization management.
  - Viem-powered blockchain interactions.

- **Gelato Relay Integration**:
  - Gasless transactions via `sponsoredCallERC2771`.
  - Increment a counter on contracts deployed on **Base Sepolia** and **Arbitrum Sepolia**.

---

## Prerequisites

1. **Node.js**: Install [Node.js](https://nodejs.org/) (v16 or later).
2. **Turnkey API Key**: Obtain from [Turnkey](https://turnkey.com).
3. **Gelato API Key**: Register and get a key from [Gelato Network](https://gelato.network).

### Environment Variables

Fill out the `.env` file with the required keys.

---

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/gelatodigital/gelato-tunrkey-passkeys-relay.git
   cd gelato-tunrkey-passkeys-relay
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Start the development server:
   ```bash
   pnpm run dev
   ```

---

## Usage

### Wallet Management with Turnkey

1. Create a wallet:

   - Click **Create New Wallet** on the homepage.
   - A wallet will be created under a Turnkey Sub-Organization.

2. Login:
   - Click **Login to sub-org with existing passkey** to log in with an existing wallet.

---

### Counter Contract Interaction

#### Fetch Counter Value

```typescript
const fetchCounterValue = async (network: "baseSepolia" | "arbSepolia") => {
  const publicClient = createPublicClient({
    chain: network === "baseSepolia" ? baseSepolia : arbitrumSepolia,
    transport: http(),
  });

  const counterValue = await publicClient.readContract({
    address:
      network === "baseSepolia"
        ? COUNTER_CONTRACT_ADDRESS
        : ARBITRUM_SEPOLIA_CONTRACT_ADDRESS,
    abi,
    functionName: "contextCounter",
    args: [wallet.address],
  });

  setCounterValue(Number(counterValue));
};
```

#### Increment Counter with Gelato Relay

```typescript
const sponsoredCallIncrementCounter = async (
  network: "baseSepolia" | "arbSepolia"
) => {
  const relay = new GelatoRelay();
  const incrementData = encodeFunctionData({
    abi,
    functionName: "increment",
    args: [],
  });

  const relayRequest = {
    user: wallet.address,
    chainId: BigInt(await viemClient.getChainId()),
    target:
      network === "baseSepolia"
        ? COUNTER_CONTRACT_ADDRESS
        : ARBITRUM_SEPOLIA_CONTRACT_ADDRESS,
    data: incrementData,
  };

  const relayResponse = await relay.sponsoredCallERC2771(
    relayRequest,
    viemClient,
    GELATO_API_KEY
  );

  console.log(`Transaction submitted! Task ID: ${relayResponse.taskId}`);
};
```

### Supported Networks

- Base Sepolia
- Arbitrum Sepolia

---

## Deployment

1. Build the project:

   ```bash
   pnpm run build
   ```

2. Deploy the project:
   ```bash
   pnpm run start
   ```

---

## Learn More

- [Turnkey Documentation](https://docs.turnkey.com)
- [Gelato Relay Documentation](https://docs.gelato.network)

---

## Contributions

Feel free to open issues or create pull requests for suggestions and improvements!
