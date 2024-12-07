import { createAccount } from "@turnkey/viem";
import { useTurnkey } from "@turnkey/sdk-react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import axios from "axios";
import { useState, useEffect } from "react";
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
} from "viem";
import { baseSepolia, sepolia, arbitrumSepolia } from "viem/chains";
import styles from "./index.module.css";
import { TWalletDetails } from "../types";
import { abi } from "../../abi/counter2771";

//Gelato imports
import {
  CallWithERC2771Request,
  GelatoRelay,
} from "@gelatonetwork/relay-sdk-viem";

const COUNTER_CONTRACT_ADDRESS = "0x79dBe2Ce05f44195B502c2f160f35fcab9190308";
const ARBITRUM_SEPOLIA_CONTRACT_ADDRESS =
  "0xfB1862BD2083DAe03Ae77E64b1B1f6168240D25D";
const TRUSTED_FORWARDER = "0xd8253782c45a12053594b9deB72d8e8aB2Fca54c";
const GELATO_API_KEY = ""; // Add your Gelato API key here

type subOrgFormData = {
  subOrgName: string;
};

type signingFormData = {
  messageToSign: string;
};

type TWalletState = TWalletDetails | null;

type TSignedMessage = {
  message: string;
  signature: string;
} | null;

const humanReadableDateTime = (): string => {
  return new Date().toLocaleString().replaceAll("/", "-").replaceAll(":", ".");
};

export default function Home() {
  const { turnkey, passkeyClient } = useTurnkey();

  // Wallet is used as a proxy for logged-in state
  const [wallet, setWallet] = useState<TWalletState>(null);
  const [signedMessage, setSignedMessage] = useState<TSignedMessage>(null);
  const [counterValue, setCounterValue] = useState<number | null>(null);
  const [loadingCounter, setLoadingCounter] = useState(false);

  const { handleSubmit: subOrgFormSubmit } = useForm<subOrgFormData>();
  const { register: signingFormRegister, handleSubmit: signingFormSubmit } =
    useForm<signingFormData>();
  const { register: _loginFormRegister, handleSubmit: loginFormSubmit } =
    useForm();

  // First, logout user if there is no current wallet set
  useEffect(() => {
    (async () => {
      if (!wallet) {
        await turnkey?.logoutUser();
      }
    })();
  });

  const fetchCounterValue = async (network: "baseSepolia" | "arbSepolia") => {
    if (!wallet) {
      throw new Error("wallet not found");
    }

    setLoadingCounter(true);

    // Define the chain and contract settings dynamically
    const networkConfig = {
      baseSepolia: {
        chain: baseSepolia,
        target: COUNTER_CONTRACT_ADDRESS,
      },
      arbSepolia: {
        chain: arbitrumSepolia,
        target: ARBITRUM_SEPOLIA_CONTRACT_ADDRESS,
      },
    };

    const { chain, target } = networkConfig[network];

    try {
      const publicClient = createPublicClient({
        chain,
        transport: http(),
      });

      // Fetch the counter value
      const counterValue = await publicClient.readContract({
        address: target as `0x${string}`, // Cast to the expected type,
        abi: abi,
        functionName: "contextCounter",
        args: [wallet.address],
      });

      setCounterValue(Number(counterValue));
      console.log(`Counter value (${network}): ${counterValue}`);
    } catch (e: any) {
      console.error(`Caught error: ${e.toString()}`);
    } finally {
      setLoadingCounter(false);
    }
  };

  const sponsoredCallIncrementCounter = async (
    network: "baseSepolia" | "arbSepolia"
  ) => {
    if (!wallet) {
      throw new Error("wallet not found");
    }

    // Define the chain and contract settings dynamically
    const networkConfig = {
      baseSepolia: {
        chain: baseSepolia,
        target: COUNTER_CONTRACT_ADDRESS,
        trustedForwarder: TRUSTED_FORWARDER,
      },
      arbSepolia: {
        chain: arbitrumSepolia,
        target: ARBITRUM_SEPOLIA_CONTRACT_ADDRESS,
        trustedForwarder: TRUSTED_FORWARDER,
      },
    };

    const { chain, target, trustedForwarder } = networkConfig[network];

    // Logic here to increment the counter
    try {
      const relay = new GelatoRelay({
        contract: {
          relay1BalanceERC2771: trustedForwarder,
          relayERC2771: "",
          relayERC2771zkSync: "",
          relay1BalanceERC2771zkSync: "",
          relayConcurrentERC2771: "",
          relay1BalanceConcurrentERC2771: "",
          relayConcurrentERC2771zkSync: "",
          relay1BalanceConcurrentERC2771zkSync: "",
        },
      });

      // create a local account
      const viemAccount = await createAccount({
        client: passkeyClient!,
        organizationId: wallet.subOrgId,
        signWith: wallet.address,
        ethereumAddress: wallet.address,
      });

      const viemClient = createWalletClient({
        account: viemAccount,
        chain: chain,
        transport: http(),
      });

      // Encode the increment function
      const incrementData = encodeFunctionData({
        abi,
        functionName: "increment",
        args: [],
      });

      // Create the request
      const relayRequest = {
        user: wallet.address,
        chainId: BigInt(await viemClient.getChainId()),
        target: target,
        data: incrementData,
      } as CallWithERC2771Request;

      // Make the request
      const relayResponse = await relay.sponsoredCallERC2771(
        relayRequest,
        viemClient as any,
        GELATO_API_KEY
      );
      console.log(`Transaction submitted! Task ID: ${relayResponse.taskId}`);
      console.log(
        `https://relay.gelato.digital/tasks/status/${relayResponse.taskId}`
      );
      alert("Transaction submitted! Fetching updated counter value...");
      await fetchCounterValue(network);
    } catch (e: any) {
      console.error(`Caught error: ${e.toString()}`);
    }
  };

  const signMessage = async (data: signingFormData) => {
    if (!wallet) {
      throw new Error("wallet not found");
    }

    const viemAccount = await createAccount({
      client: passkeyClient!,
      organizationId: wallet.subOrgId,
      signWith: wallet.address,
      ethereumAddress: wallet.address,
    });

    const viemClient = createWalletClient({
      account: viemAccount,
      chain: sepolia,
      transport: http(),
    });

    const signedMessage = await viemClient.signMessage({
      message: data.messageToSign,
    });

    setSignedMessage({
      message: data.messageToSign,
      signature: signedMessage,
    });
  };

  const createSubOrgAndWallet = async () => {
    const subOrgName = `Turnkey Viem+Passkey Demo - ${humanReadableDateTime()}`;
    const credential = await passkeyClient?.createUserPasskey({
      publicKey: {
        rp: {
          id: "localhost",
          name: "Turnkey Viem Passkey Demo",
        },
        user: {
          name: subOrgName,
          displayName: subOrgName,
        },
      },
    });

    if (!credential?.encodedChallenge || !credential?.attestation) {
      return false;
    }

    const res = await axios.post("/api/createSubOrg", {
      subOrgName: subOrgName,
      challenge: credential?.encodedChallenge,
      attestation: credential?.attestation,
    });

    const response = res.data as TWalletDetails;
    setWallet(response);
  };

  const login = async () => {
    try {
      // Initiate login (read-only passkey session)
      const loginResponse = await passkeyClient?.login();
      if (!loginResponse?.organizationId) {
        return;
      }

      const currentUserSession = await turnkey?.currentUserSession();
      if (!currentUserSession) {
        return;
      }

      const walletsResponse = await currentUserSession?.getWallets();
      if (!walletsResponse?.wallets[0].walletId) {
        return;
      }

      const walletId = walletsResponse?.wallets[0].walletId;
      const walletAccountsResponse =
        await currentUserSession?.getWalletAccounts({
          organizationId: loginResponse?.organizationId,
          walletId,
        });
      if (!walletAccountsResponse?.accounts[0].address) {
        return;
      }

      setWallet({
        id: walletId,
        address: walletAccountsResponse?.accounts[0].address,
        subOrgId: loginResponse.organizationId,
      } as TWalletDetails);
    } catch (e: any) {
      const message = `caught error: ${e.toString()}`;
      console.error(message);
      alert(message);
    }
  };

  return (
    <main className={styles.main}>
      <a href="https://turnkey.com" target="_blank" rel="noopener noreferrer">
        <Image
          src="/turnkey_image.png"
          alt="Turnkey Logo"
          className={styles.turnkeyLogo}
          width={100}
          height={24}
          priority
        />
      </a>
      <span className={styles.logoSeparator}>+</span>
      <a
        href="https://gelato.network"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Image
          src="/Gelato_white_.png"
          alt="Gelato Logo"
          className={styles.gelatoLogo}
          width={100}
          height={24}
          priority
        />
      </a>
      <div>
        {wallet !== null && (
          <div className={styles.info}>
            Your sub-org ID: <br />
            <span className={styles.code}>{wallet.subOrgId}</span>
          </div>
        )}
        {wallet && (
          <div className={styles.info}>
            ETH address: <br />
            <span className={styles.code}>{wallet.address}</span>
          </div>
        )}
        {signedMessage && (
          <div className={styles.info}>
            Message: <br />
            <span className={styles.code}>{signedMessage.message}</span>
            <br />
            <br />
            Signature: <br />
            <span className={styles.code}>{signedMessage.signature}</span>
            <br />
            <br />
            <a
              href="https://etherscan.io/verifiedSignatures"
              target="_blank"
              rel="noopener noreferrer"
            >
              Verify with Etherscan
            </a>
          </div>
        )}
      </div>
      {!wallet && (
        <div>
          <h2>Create a new wallet</h2>
          <p className={styles.explainer}>
            We&apos;ll prompt your browser to create a new passkey. The details
            (credential ID, authenticator data, client data, attestation) will
            be used to create a new{" "}
            <a
              href="https://docs.turnkey.com/getting-started/sub-organizations"
              target="_blank"
              rel="noopener noreferrer"
            >
              Turnkey Sub-Organization
            </a>{" "}
            and a new{" "}
            <a
              href="https://docs.turnkey.com/getting-started/wallets"
              target="_blank"
              rel="noopener noreferrer"
            >
              Wallet
            </a>{" "}
            within it.
            <br />
            <br />
            This request to Turnkey will be created and signed by the backend
            API key pair.
          </p>
          <form
            className={styles.form}
            onSubmit={subOrgFormSubmit(createSubOrgAndWallet)}
          >
            <input
              className={styles.button}
              type="submit"
              value="Create new wallet"
            />
          </form>
          <br />
          <br />
          <h2>Already created your wallet? Log back in</h2>
          <p className={styles.explainer}>
            Based on the parent organization ID and a stamp from your passkey
            used to created the sub-organization and wallet, we can look up your
            sub-organization using the{" "}
            <a
              href="https://docs.turnkey.com/api#tag/Who-am-I"
              target="_blank"
              rel="noopener noreferrer"
            >
              Whoami endpoint.
            </a>
          </p>
          <form className={styles.form} onSubmit={loginFormSubmit(login)}>
            <input
              className={styles.button}
              type="submit"
              value="Login to sub-org with existing passkey"
            />
          </form>
        </div>
      )}
      {wallet !== null && (
        <div>
          <h2>Check Your Counter Value!</h2>
          <p className={styles.explainer}>
            We&apos;ll use a{" "}
            <a
              href="https://viem.sh/docs/accounts/custom.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              Viem custom account
            </a>{" "}
            to sign your address and fetch your counter value from the{" "}
            <a
              href="https://etherscan.io/address/0x79dBe2Ce05f44195B502c2f160f35fcab9190308"
              target="_blank"
              rel="noopener noreferrer"
            >
              CounterERC2771 contract
            </a>
            . This will demonstrate seamless integration of Viem and Turnkey.
          </p>
          <div>
            <h2>Increment Counter with Gelato Relay</h2>
            <p className={styles.explainer}>
              This will use <strong>Gelato Relay</strong> to send a relayed
              transaction to increment the counter. Your wallet address will
              sign the transaction, and it will be relayed securely.
            </p>
            <button
              className={styles.button}
              onClick={() => sponsoredCallIncrementCounter("baseSepolia")}
            >
              Increment Counter (Base Sepolia)
            </button>
          </div>
          <div>
            <h3>Arbitrum Sepolia</h3>
            <button
              className={styles.button}
              onClick={() => sponsoredCallIncrementCounter("arbSepolia")}
            >
              Increment Counter (Arbitrum Sepolia)
            </button>
          </div>
          {counterValue !== null && (
            <div className={styles.info}>
              Counter Value: <br />
              <span className={styles.code}>{counterValue}</span>
              <br />
              <br />
              Wallet Address: <br />
              <span className={styles.code}>{wallet.address}</span>
            </div>
          )}
          {loadingCounter && (
            <div className={styles.info}>
              <span>Loading counter value...</span>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
