/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, {useState} from 'react';
import type {PropsWithChildren} from 'react';
import {
  Button,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';

import {Colors} from 'react-native/Libraries/NewAppScreen';
import {transact} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import {
  Connection,
  clusterApiUrl,
  PublicKey,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
  VersionedTransaction,
  TransactionMessage,
} from '@solana/web3.js';
import {toByteArray} from 'react-native-quick-base64';
import {TextEncoder} from 'text-encoding';

type SectionProps = PropsWithChildren<{
  title: string;
}>;

function Section({children, title}: SectionProps): JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  return (
    <View style={styles.sectionContainer}>
      <Text
        style={[
          styles.sectionTitle,
          {
            color: isDarkMode ? Colors.white : Colors.black,
          },
        ]}>
        {title}
      </Text>
      <Text
        style={[
          styles.sectionDescription,
          {
            color: isDarkMode ? Colors.light : Colors.dark,
          },
        ]}>
        {children}
      </Text>
    </View>
  );
}

export const APP_IDENTITY = {
  name: 'Hyperdrive Workshop App',
  uri: 'https://yourdapp.com',
  icon: 'favicon.ico', // Full path resolves to https://yourdapp.com/favicon.ico
};

type Account = {
  address: string; // base64 address
  authToken: string;
};

function getPubkeyFromAddress(bs64Address: string) {
  const byteArray = toByteArray(bs64Address);
  return new PublicKey(byteArray);
}

function App(): JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const backgroundStyle = {
    backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
  };
  const [currentAccount, setCurrentAccount] = useState<Account | null>(null);
  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const refreshBalance = async (pubKey: PublicKey) => {
    const connection = new Connection(clusterApiUrl('testnet'));
    const fetchedBalance = await connection.getBalance(pubKey);
    console.log('Balance fetched: ' + fetchedBalance);
    setCurrentBalance(fetchedBalance);
  };

  const handleConnectPress = async () => {
    const authResult = await transact(async wallet => {
      const authorizationResult = await wallet.authorize({
        cluster: 'testnet',
        identity: APP_IDENTITY,
      });
      return authorizationResult;
    });
    setCurrentAccount({
      address: authResult.accounts[0].address,
      authToken: authResult.auth_token,
    });
    const pubKey = getPubkeyFromAddress(authResult.accounts[0].address);
    refreshBalance(pubKey);
  };

  const handleAirdropRequest = async () => {
    const connection = new Connection(clusterApiUrl('testnet'), 'finalized');
    const pubKey = getPubkeyFromAddress(currentAccount!.address);
    const signature = await connection.requestAirdrop(pubKey, LAMPORTS_PER_SOL);
    const result = await connection.confirmTransaction(signature, 'finalized');
    if (result.value.err) {
      console.error(result.value.err);
    } else {
      refreshBalance(pubKey);
    }
  };

  const handleMemoPress = async () => {
    const connection = new Connection(clusterApiUrl('testnet'), 'finalized');
    const latestBlockhash = await connection.getLatestBlockhash();
    const pubKey = getPubkeyFromAddress(currentAccount!.address);

    const message = 'Hello Solana';
    const messageBuffer = new TextEncoder().encode(message) as Buffer;

    // 1. Build a Versioned Transaction
    const instructions = [
      new TransactionInstruction({
        keys: [],
        programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
        data: messageBuffer,
      }),
    ];
    const txMessage = new TransactionMessage({
      payerKey: pubKey,
      recentBlockhash: latestBlockhash.blockhash,
      instructions,
    }).compileToV0Message();

    const memoTransaction = new VersionedTransaction(txMessage);

    // const memoTransaction = new Transaction({
    //   ...latestBlockhash,
    //   feePayer: pubKey,
    // }).add(
    //   // 2. Add an instruction call to the Memo Program
    //   new TransactionInstruction({
    //     keys: [],
    //     programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
    //     data: messageBuffer,
    //   }),
    // );

    // 3. Sign the transaction with MWA
    const signedTx = await transact(async wallet => {
      const authorizationResult = await wallet.reauthorize({
        auth_token: currentAccount!.authToken,
        identity: APP_IDENTITY,
      });

      const signedTxs = await wallet.signTransactions({
        transactions: [memoTransaction],
      });

      return signedTxs[0];
    });

    // 4. Use RPC client to submit the transaction
    const memoTransactionSignature = await connection.sendTransaction(signedTx);
    const confirmationResult = await connection.confirmTransaction(
      memoTransactionSignature,
      'confirmed',
    );
    if (confirmationResult.value.err) {
      // Transaction was unsuccessfully submitted.
      throw new Error(JSON.stringify(confirmationResult.value.err));
    } else {
      console.log('Memo success!');
      const explorerUrl =
        'https://explorer.solana.com/tx/' +
        memoTransactionSignature +
        '?cluster=' +
        'testnet';
      console.log(explorerUrl);
    }
  };

  return (
    <SafeAreaView style={backgroundStyle}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={backgroundStyle.backgroundColor}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={backgroundStyle}>
        {currentAccount ? (
          <>
            <Section title="Wallet Info">
              <Text>Address: {currentAccount.address} </Text>
              {'\n\n'}
              <Text>Balance: {currentBalance / LAMPORTS_PER_SOL} SOL </Text>
            </Section>
            <Section title="Request an airdrop">
              <Button title="Airdrop" onPress={handleAirdropRequest} />
            </Section>
            <Section title="Say hello world">
              <Button title="Memo" onPress={handleMemoPress} />
            </Section>
          </>
        ) : (
          <Section title="Connect to a wallet">
            <Button title="Connect Wallet" onPress={handleConnectPress} />
          </Section>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  sectionDescription: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '400',
  },
  highlight: {
    fontWeight: '700',
  },
});

export default App;
