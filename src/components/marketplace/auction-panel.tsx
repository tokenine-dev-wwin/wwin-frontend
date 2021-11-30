import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import { notification as notice } from 'antd'
import { ethers, Contract } from "ethers"

import { Input, MediaComponent, CurrencyComponent } from '@/components'
import { useBEP20Contract, marketContract } from '@/contracts'
import { useAuth, useModal } from '@/hooks'
import { configs, chain } from '@/libs/configs'
import { getCookie } from '@/libs/cookies'
import { getEtherProvider, bigNumber, toUint256 } from '@/libs/web3'
import { assetService } from '@/services/assets.service'
import { dialog, loader, getRandom, getShortAddress, upperCase, lowerCase } from '@/utils'
import { NFTItem } from '@/types'
import { Connectors } from '@/types/constants'
import { useWeb3React } from '@web3-react/core'
import { useDB } from "@/hooks"

import firebaseApp from '@/libs/firebase'
import { doc, getDoc, onSnapshot, arrayUnion } from "firebase/firestore"
import { safeAddress, findMatchCurrency, createQuote, addressMask } from '@/utils/blockchain'

import { updateFirestoreDocument, loadMarketplaceSessionData } from "@/functions/firestore"

const ERC20 = {
    abi: [{ "inputs": [], "payable": false, "stateMutability": "nonpayable", "type": "constructor" }, { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "owner", "type": "address" }, { "indexed": true, "internalType": "address", "name": "spender", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" }], "name": "Approval", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "burner", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" }], "name": "Burn", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "minter", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" }], "name": "Mint", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "from", "type": "address" }, { "indexed": true, "internalType": "address", "name": "to", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" }], "name": "Transfer", "type": "event" }, { "constant": true, "inputs": [{ "internalType": "address", "name": "_owner", "type": "address" }, { "internalType": "address", "name": "_spender", "type": "address" }], "name": "allowance", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [{ "internalType": "address", "name": "_spender", "type": "address" }, { "internalType": "uint256", "name": "_value", "type": "uint256" }], "name": "approve", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [{ "internalType": "address", "name": "_owner", "type": "address" }], "name": "balanceOf", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [{ "internalType": "address", "name": "_who", "type": "address" }, { "internalType": "uint256", "name": "_value", "type": "uint256" }], "name": "burn", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [], "name": "decimals", "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [{ "internalType": "address", "name": "_to", "type": "address" }, { "internalType": "uint256", "name": "_value", "type": "uint256" }], "name": "mint", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [], "name": "name", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "symbol", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "totalSupply", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [{ "internalType": "address", "name": "_to", "type": "address" }, { "internalType": "uint256", "name": "_value", "type": "uint256" }], "name": "transfer", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": false, "inputs": [{ "internalType": "address", "name": "_from", "type": "address" }, { "internalType": "address", "name": "_to", "type": "address" }, { "internalType": "uint256", "name": "_value", "type": "uint256" }], "name": "transferFrom", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }]
}

const ERC721 = {
    abi: [{ "inputs": [{ "internalType": "string", "name": "_name", "type": "string" }, { "internalType": "string", "name": "_symbol", "type": "string" }, { "internalType": "string", "name": "_description", "type": "string" }, { "internalType": "uint256", "name": "_maxSupply", "type": "uint256" }], "stateMutability": "nonpayable", "type": "constructor" }, { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "owner", "type": "address" }, { "indexed": true, "internalType": "address", "name": "approved", "type": "address" }, { "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "Approval", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "owner", "type": "address" }, { "indexed": true, "internalType": "address", "name": "operator", "type": "address" }, { "indexed": false, "internalType": "bool", "name": "approved", "type": "bool" }], "name": "ApprovalForAll", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "userAddress", "type": "address" }, { "indexed": false, "internalType": "address payable", "name": "relayerAddress", "type": "address" }, { "indexed": false, "internalType": "bytes", "name": "functionSignature", "type": "bytes" }], "name": "MetaTransactionExecuted", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "previousOwner", "type": "address" }, { "indexed": true, "internalType": "address", "name": "newOwner", "type": "address" }], "name": "OwnershipTransferred", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "from", "type": "address" }, { "indexed": true, "internalType": "address", "name": "to", "type": "address" }, { "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "Transfer", "type": "event" }, { "inputs": [], "name": "ERC712_VERSION", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "approve", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }], "name": "balanceOf", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "baseQrURL", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "baseTokenURI", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "description", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "userAddress", "type": "address" }, { "internalType": "bytes", "name": "functionSignature", "type": "bytes" }, { "internalType": "bytes32", "name": "sigR", "type": "bytes32" }, { "internalType": "bytes32", "name": "sigS", "type": "bytes32" }, { "internalType": "uint8", "name": "sigV", "type": "uint8" }], "name": "executeMetaTransaction", "outputs": [{ "internalType": "bytes", "name": "", "type": "bytes" }], "stateMutability": "payable", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "getApproved", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "getChainId", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "getDomainSeperator", "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "user", "type": "address" }], "name": "getNonce", "outputs": [{ "internalType": "uint256", "name": "nonce", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }, { "internalType": "address", "name": "operator", "type": "address" }], "name": "isApprovedForAll", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "maxSupply", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "_to", "type": "address" }], "name": "mintTo", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [], "name": "name", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "owner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "ownerOf", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "_tokenId", "type": "uint256" }], "name": "qrURL", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "renounceOwnership", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "from", "type": "address" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "safeTransferFrom", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "from", "type": "address" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "tokenId", "type": "uint256" }, { "internalType": "bytes", "name": "_data", "type": "bytes" }], "name": "safeTransferFrom", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "operator", "type": "address" }, { "internalType": "bool", "name": "approved", "type": "bool" }], "name": "setApprovalForAll", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "string", "name": "_url", "type": "string" }], "name": "setBaseQrURL", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "string", "name": "_uri", "type": "string" }], "name": "setBaseTokenURI", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "bytes4", "name": "interfaceId", "type": "bytes4" }], "name": "supportsInterface", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "symbol", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "index", "type": "uint256" }], "name": "tokenByIndex", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }, { "internalType": "uint256", "name": "index", "type": "uint256" }], "name": "tokenOfOwnerByIndex", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "_tokenId", "type": "uint256" }], "name": "tokenURI", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "totalSupply", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "from", "type": "address" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "transferFrom", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "newOwner", "type": "address" }], "name": "transferOwnership", "outputs": [], "stateMutability": "nonpayable", "type": "function" }]
}

interface ContractConfig {
    name: string;
    symbol?: string;
    address: { [chainId: string]: string }
}

interface ERC721ContractConfig {
    name: string;
    symbol?: string;
    address: string;
}

const ERC20Tokens = {
    "WBNB": {
        name: "WBNB Token",
        symbol: "WBNB",
        address: {
            "56" /* BSC Mainnet */: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
            "97" /* BSC Testnet */: "0xae13d989dac2f0debff460ac112a837c89baa7cd"
        }
    },
    "CLAIM": {
        name: "CLAIM Token",
        symbol: "CLAIM",
        address: {
            "56" /* BSC Mainnet */: "0x01c2fa296c98355e86a159860c3f533a6de251f6",
            "97" /* BSC Testnet */: "0x05D83208DAfFbE075f070B6a3b3B29Be524a8A06"
        }
    }
}

// TODO: Fix this by move config to DB
const ERC721Tokens: { [address: string]: any } = {
    // "0xbac7e7a39ba9ba1ce20755561f48a65bc8c8d42c": {
    //   name: "SAMPLE",
    //   symbol: "WWIN-NFT",
    //   address: "0xbac7e7a39ba9ba1ce20755561f48a65bc8c8d42c", // Owned by ...5FEF
    //   chainId: "97"
    // },

    // "0xD1A21D267c5AE768Ef9f75F38b16e03490C49e4e": {
    //   name: "",
    //   symbol: "",
    //   address: "0xD1A21D267c5AE768Ef9f75F38b16e03490C49e4e", // Owned by ...8dc5
    //   chainId: "97"
    // },

    "0x8351057b11d48a02d138637c9386a7bce72b0966": {
        name: "Poramesuan Garuda “Prosperity” Gold Model",
        symbol: "GOLD",
        address: "0x8351057b11d48a02d138637c9386a7bce72b0966",
        chainId: "56"
    },

    "0xd1a21d267c5ae768ef9f75f38b16e03490c49e4e": {
        name: "Poramesuan Garuda “Prosperity” White Gold Model",
        symbol: "WHITE GOLD",
        address: "0xd1a21d267c5ae768ef9f75f38b16e03490c49e4e",
        chainId: "56"
    },

    "0x714294ae8718527b3660247ef022c8294458478b": {
        name: "Poramesuan Garuda “Prosperity” Pink Gold Model",
        symbol: "PINK GOLD",
        address: "0x714294ae8718527b3660247ef022c8294458478b",
        chainId: "56"
    },
}


/* 
 / Sequences
 / Approve Auction Operator Contract for ERC20 then it can be use to pay
 / Button and Input for add bid
*/
export function AuctionPanelComponent({ data }: any) {
    // __STATE <React.Hooks>
    console.log("AuctionPanelComponent", data )
    const { marketplace_item_id, nft_marketplace_item } = data
    const { current_market_session, current_market_session_active } = nft_marketplace_item

    const { signin } = useAuth()
    const { db } = useDB()
    const { account, chainId } = useWeb3React();

    const [ bidList, setBidList ] = useState<any>([])

    const [isClaimingPanelActive, setIsClaimingPanelActive] = useState(false)
    const CLAIMapprovalState = useState(true)
    const [isCLAIMApproved, /* setIsApproved */] = CLAIMapprovalState
    const WBNBapprovalState = useState(true)
    const [isWBNBapproved, /* setIsApproved */] = WBNBapprovalState
    const isClaimableState = useState(false)
    const [isClamable, /* setIsClaimable */] = isClaimableState
    const [totalAvailable, setTotalAvailable] = useState(0)
    const [ERC20tokens, setERC20tokens] = useState<{ [symbol: string]: any }>({ address: "" })
    const [NFTcontract, setNFTcontract] = useState<any>({ address: "" })
    const NFTswap = getNFTswapContract()
    const NFTregistry = getNFTregistryContract()


    const [ priceInput, setPriceInput ] = useState("0")
    const [ currencyInput, setCurrencyInput ] = useState(findMatchCurrency("0x0"))
    const [ loading, setLoading ] = useState(true)
    const [ session, setSession ] = useState<any>(null)

    // const [ currentCurrency, setCurrentCurrency ] = useState(CLAIMtoken.address)
    // const { onModalActive: modal } = useModal(null, 'checkout')

    // Get data and subscribe to data changing
    useEffect(() => {
        setLoading(true);
        let unsubscribe = () => {};
    
        
        const current_market_session_id = marketplace_item_id + "@" + current_market_session
        if (db && current_market_session_active) {
          (async () => {
            if (current_market_session) {
                const data_ = await loadMarketplaceSessionData(db, current_market_session_id)
                data_.participants = data_.participants.reverse()
                setSession(data_)
            }
            setLoading(false);
          })();
      
          const docRef = doc(db, "nft_marketplace:sessions", current_market_session_id);
          unsubscribe = onSnapshot(docRef, 
            { includeMetadataChanges: true },
            (doc: any) => {
                const data_ = doc.data()
                data_.participants = data_.participants.reverse()
                setSession(data_)
            }
          );
        }
    
        return () => {
          setSession([])
          setLoading(false)
          unsubscribe()
        }
    }, [marketplace_item_id])

    // __EFFECTS <React.Hooks>
    useEffect(() => {
        const ERC721_address = data.tokenAddress?.toLowerCase()
        const ERC721_config = ERC721Tokens[ERC721_address]
        console.log("ERC721 initializing", ERC721_config)
        if (ERC721_config) {
            const WBNB = getERC20tokenContract(ERC20Tokens["WBNB"], "56");
            const CLAIM = getERC20tokenContract(ERC20Tokens["CLAIM"], "56");
            const NFTcontract_ = getNFTContract(ERC721Tokens[ERC721_address])
            setNFTcontract(NFTcontract_)
            setERC20tokens({ ...ERC20Tokens, WBNB, CLAIM })
        }

        if (!account) {
            const connector: Connectors = getCookie(configs.CONNECTOR)
            signin(connector)
        } else {
            if (ERC721Tokens[ERC721_address]) {
                getNFTtokensAvailable(ERC721_address)
                    .then((availableList) => setTotalAvailable(availableList.length))
            }
        }

    }, [account, signin,])

    useEffect(() => {
        if (typeof account === "string") {
            console.log("Checking Contracts")
            console.log("Checking Approval", NFTswap)
            checkERC20Approval(account, "WBNB", NFTswap?.address, WBNBapprovalState).then().catch()
            checkERC20Approval(account, "CLAIM", NFTswap?.address, CLAIMapprovalState).then().catch()
            if (ERC20tokens["CLAIM"]) {
                checkClaimBalance(account, isClaimableState)
            }
        }

    }, [account, ERC20tokens["CLAIM"]?.contract, ERC20tokens["WBNB"]?.contract, NFTswap?.contract])

    // __FUNCTIONS
    const handleSignin = useCallback(() => {
        signin(Connectors.Injected)
    }, [])

    const handleShop = async (erc20_address?: string) => {
        setIsClaimingPanelActive(!isClaimingPanelActive)

        // Open Popup on Click
        // Get Random of Available List
        const tokenAddress = data.tokenAddress.toLowerCase()
        const availableList = await getNFTtokensAvailable(tokenAddress)
        console.log("CHECK", availableList)

        // Show Random Serial Number
        let randomNo = randomPick(availableList)

        // Show Swap Item
        if (erc20_address && ERC20tokens[erc20_address].contract) {
            console.log(await ERC20tokens[erc20_address].contract.name())
            console.log((await ERC20tokens[erc20_address].contract.balanceOf("0x15B0E6d785F3eEdF32B3B8D7Abcb7E6001E18Dc5")).toString())
        }

        async function swapNFTbyNative(serialNo: number) {

            if (NFTswap.contract && NFTregistry.contract) {
            
                const amount = ethers.utils.parseEther(data.price.toString());
                const slot = await NFTregistry.contract.getNFTslotState(NFTcontract?.address, serialNo)
                console.log(slot, amount, serialNo)
                // // console.log(slot, totalSupply, serialNo)
                const totalSupply = (await NFTcontract?.contract.totalSupply()).toNumber()

                if (!slot.exists && serialNo <= totalSupply) {
                    try {
                        const tx = await NFTswap.contract.swapNFTbyNative(NFTcontract?.address, serialNo, "", "{}",
                            {
                                value: amount,
                                gasLimit: 15000000,
                            })
                        const result = await tx.wait();
                        console.log(NFTswap.error, tx, result);
                    } catch (error: any) {
                        console.error(error);
                        if (error?.code === -32603) {
                            if (error?.data?.code === -32000) {
                                alert("Insufficient BNB to buy")
                            }
                        }
                    }
                } else {
                    let _randomNo = randomPick(availableList)
                    await swapNFTbyNative(_randomNo)
                }
            }
        }


        await swapNFTbyNative(randomNo)
    }

    const handleClaim = async () => {
        setIsClaimingPanelActive(!isClaimingPanelActive)
        // Open Popup on Click
        // Get Random of Available List
        const availableList = await getNFTtokensAvailable(data.tokenAddress)
        // Show Random Serial Number
        let randomNo = randomPick(availableList)
        // Show Swap Item
        if (ERC20tokens["CLAIM"]?.contract) {
            console.log(await ERC20tokens["CLAIM"]?.contract.name())
            console.log((await ERC20tokens["CLAIM"]?.contract.balanceOf("0x15B0E6d785F3eEdF32B3B8D7Abcb7E6001E18Dc5")).toString())
        }

        async function claimNFT(serialNo: number) {
            if (NFTswap.contract && NFTregistry.contract) {
                const amount = ethers.utils.parseEther("1");
                const slot = await NFTregistry.contract.getNFTslotState(NFTcontract?.address, serialNo)

                const totalSupply = (await NFTcontract?.contract.totalSupply()).toNumber()
                // console.log(slot, totalSupply, serialNo)

                if (!slot.exists && serialNo <= totalSupply) {
                    const tx = await NFTswap.contract.swapNFT(NFTcontract?.address, serialNo, ERC20tokens["CLAIM"]?.address, amount, "", "{}")
                    console.log(tx, ERC20tokens["CLAIM"]?.address, amount, NFTcontract?.address, 1)
                    const result = await tx.wait();
                    console.log(NFTswap.error, tx, result);
                } else {
                    let _randomNo = randomPick(availableList)
                    await claimNFT(_randomNo)
                }
            }
        }

        await claimNFT(randomNo)
    }

    const handleApprove = async (CLAIMapprovalState: any) => {
        if (ERC20tokens["CLAIM"]?.contract) {
            const [, setIsCurrencyApproval] = CLAIMapprovalState;
            const tx = await ERC20tokens["CLAIM"]?.contract.approve(NFTswap.contract.address, ethers.utils.parseEther("9999999"))
            await tx.wait()
            setIsCurrencyApproval(true)
        }
    }

    const handleWBNBApprove = async (WBNBapprovalState: any) => {
        if (ERC20tokens["WBNB"]?.contract) {
            const [, setIsCurrencyApproval] = WBNBapprovalState;
            const tx = await ERC20tokens["WBNB"]?.contract.approve(NFTswap.contract.address, ethers.utils.parseEther("9999999"))
            await tx.wait()
            setIsCurrencyApproval(true)
        }
    }

    const checkClaimBalance = async (account: string, isClaimableState: any) => {
        console.log("checkClaimBalance", ERC20tokens["CLAIM"])
        const [, setIsClaimable] = isClaimableState;
        if (ERC20tokens["CLAIM"]?.contract) {
            ERC20tokens["CLAIM"]?.contract.balanceOf(account)
                .then((balance: any) => {
                    console.log("checking CLAIM", balance.toString())
                    if (balance.gte(ethers.utils.parseEther("1"))) {
                        setIsClaimable(true)
                    } else {
                        setIsClaimable(false)
                    }
                })
        }
        setIsClaimable(false)
    }

    const checkERC20Approval = async (owner: string, tokenKey: string, spender: string, approvalState: any) => {
        const [, setIsCurrencyApproval] = approvalState;
        console.log(ERC20tokens[tokenKey], spender)
        const amount = await ERC20tokens[tokenKey]?.contract?.allowance(owner, spender)
        console.log("checkERC20Approval", tokenKey, spender, amount, amount?.gt(0))
        if (amount?.gt(0)) { // Update Condition
            setIsCurrencyApproval(true)
        } else {
            setIsCurrencyApproval(false)
        }
    }
    const explorer = chain[chainId || 97].explorer

    function handlePlaceBid() {
        console.log("handlePlaceBid", priceInput, currencyInput)
        if (account) {
            placeBid(db, { ...data, account: safeAddress(account), inputs: { priceInput, currencyInput } }, handlers)
        }
    }

    function handlePriceInputChange(event: any) {
        const { value } = event.target
        // TODO: Convert to be a valid value
        setPriceInput(value)
    }

    function handleCurrencyChange(event: any) {
        const { value } = event.target
        const currencyInput_ = findMatchCurrency(value)
        if (currencyInput_) {
            setCurrencyInput(value)
        } else {
            // TODO: Handle Error UI
        }
        console.log("handleCurrencyChange", currencyInput_)
    }

    function handleClearStates() {
        setPriceInput("0")
        setCurrencyInput("0x0")
    }

    const handlers = {
        handleClearStates
    }

    // __RENDER
    return (
        <div className='ui--assets-trade'>
            <div className='status'>
                <div className='columns owner'>
                    <span className='label'>Owned by</span>
                    <a className='btn btn-default' href={`${explorer}/address/${safeAddress(nft_marketplace_item?.current_owner)}`} target='_blank'>
                        {safeAddress(nft_marketplace_item?.current_owner) === safeAddress(account || "") ? 'You' : getShortAddress(safeAddress(nft_marketplace_item?.current_owner))}
                    </a>
                </div>

                <div className='columns supply'>
                    {/* <span className='icon bi bi-archive'></span> */}
                    <span className='text'>Token Id</span>
                </div>

                <div className='columns supply'>
                    {/* <span className='icon bi bi-archive'></span> */}
                    <span className='text'>Auction Timer</span>
                </div>
            </div>

            <div className='actions-box actions'>
                <div className='label'>Latest Bids</div>
                <CurrencyComponent currency={session?.current_participation?.quote.symbol} amount={session?.current_participation?.quote.price} size='large'>
                    <small className='unit'>{ session?.current_participation?.quote.symbol }</small>
                </CurrencyComponent>

                <div className="_divider"></div>

                {account ? (
                    <div>
                        { safeAddress(account) !== safeAddress(nft_marketplace_item?.current_owner)
                            ? (<div id="auction-bid-input-panel">
                                <div className="_inputs">
                                    <input type="number" className="_textinput" onChange={ handlePriceInputChange }></input>
                                    <select className="_selectbox" value={currencyInput} onChange={ handleCurrencyChange }>
                                        <option value="0x0">BNB</option>
                                    </select>
                                </div>
                                <div className="_actions">
                                    <button className='btn btn-dark btn-connect' onClick={() => { handlePlaceBid() }}>
                                        <span className='icon bi bi-bag'></span>
                                        <span className='text'>Place Bid</span>
                                    </button>
                                </div>
                            </div>)
                            : (<></>)
                        }

                        {/* {
                            !isWBNBapproved ? (
                                <button className='btn btn-dark btn-connect' onClick={() => { handleWBNBApprove(WBNBapprovalState) }}>
                                    <span className='icon bi bi-bag'></span>
                                    <span className='text'>Approve to Buy</span>
                                </button>
                            ) : (
                                <button className='btn btn-dark btn-shop' disabled={totalAvailable < 1} onClick={() => handleShop()}>
                                    <span className='icon bi bi-basket2'></span>
                                    <span className='text'>{totalAvailable < 1 ? 'out of stock' : 'buy now'}</span>
                                </button>
                            )
                        }
                        {
                            data.is_presale && (!isCLAIMApproved ? (
                                <button className='btn btn-dark btn-connect' onClick={() => { handleApprove(CLAIMapprovalState) }}>
                                    <span className='icon bi bi-bag'></span>
                                    <span className='text'>Approve to Claim</span>
                                </button>
                            ) : (
                                <button disabled={!isClamable} className='btn btn-dark btn-connect' onClick={handleClaim}>
                                    <span className='icon bi bi-bag'></span>
                                    <span className='text'>{!isClamable ? 'You have no Claim token' : 'Claim Now'}</span>
                                </button>
                            ))
                        } */}
                    </div>
                ) : (
                    <button className='btn btn-dark btn-connect' onClick={handleSignin}>
                        <span className='icon bi bi-wallet2'></span>
                        <span className='text'>Connect Wallet</span>
                    </button>
                )}

                <div className="_divider"></div>
                <div id="bids-box">
                    <div className="label">Bids</div>
                    <div className="_entries">
                        {
                            session?.participants?.map((bid: any, index: number) => (
                                <div className="_entry" key={session._id + "/" + index}>
                                    <span className="_user">
                                        { addressMask(bid.user) }
                                    </span>
                                    <span className="_price">
                                        { bid.quote.price }
                                    </span>
                                    <span className="_symbol">
                                        { bid.quote.symbol }
                                    </span>
                                    <span className="_timestamp">
                                        { bid.timestamp }
                                    </span>
                                </div>)
                            )
                        }
                    </div>
                </div>
            </div>
        </div>
    )
}

/* 

*/



function placeBid(db: any, data: any, handlers: any) {
    console.log("Place Bid")
    const { inputs, marketplace_item_id } = data;
    const contract_address = safeAddress(data.contract_address)
    const sell_type = "auction"
    const quote = createQuote(inputs)

    commitBidData(db, {
        ...data,
        contract_address,
        marketplace_item_id,
        sell_type,
        quote
    })
        .then(() => {
            // return handlers.updateSingleNFTData(contract_address, account).then().catch()
        })
        .then(() => {
            // Update UI
            // handlers.handleClearStates()
            // handlers.handleCloseAuctionSetupPanel()

        })
        .catch((error: any) => {
            console.error(error)
            // handlers.handleCloseAuctionSetupPanel()
        })
}

async function commitBidData(db: any, data: any) {
    try {
        const { quote, account } = data;
        const timestamp = new Date().getTime()
        console.log("commitBidData", data);

        const current_participation = {
            quote,
            user: account,
            timestamp
        }

        const marketplace_session_id = data.marketplace_item_id + "@" + data.nft_marketplace_item?.current_market_session

        // const current_market_session = timestamp
        // Create a transaction with MetaMask

        // Update Off-chain Data

        //
        await setNFTMarketplaceSessionData(db,
            {
                ...data,
                marketplace_session_id,
                timestamp,
                payload: {
                    marketplace_session: {
                        current_participation,
                        participants: arrayUnion(current_participation),
                    }
                }
            }
        )

    } catch (error) {
        console.error(error)
    }
}



async function setNFTMarketplaceSessionData(db: any, data: any) {
    try {
        // const collection_nft_marketplace_items = "nft_marketplace:items";
        // const collection_nft_marketplace_lists = "nft_marketplace:lists";
        const collection_nft_marketplace_sessions = "nft_marketplace:sessions";

        if (data.marketplace_session_id) {
            // await setFirestoreDocument(db, collection_nft_marketplace_items, safeAddress(data.marketplace_item_id), data.payload.marketplace_item, { merge: true })
            // await setFirestoreDocument(db, collection_nft_marketplace_lists, "auction:recent", {
            //     list: arrayUnion(data.marketplace_item_id)
            // })
            await updateFirestoreDocument(db, collection_nft_marketplace_sessions, data.marketplace_session_id, data.payload.marketplace_session)
        }

    } catch (error: any) {

    }
}

/* 
    TO BE REMOVED
*/

export function ModalChackout({ item, account }: { item: NFTItem; account: string }) {
    // __STATE <React.Hooks>
    const [wait, setWait] = useState<boolean>(false)
    const [agree, setAgree] = useState<boolean>(false)
    const [allowance, setAllowance] = useState<number>(0)
    const { onModalActive: modal } = useModal(null, 'success')
    const { chainId } = useWeb3React()

    const coinContract = useBEP20Contract(item.currency)
    const isBNB = lowerCase(item.currency) === 'bnb'

    const tokenId = getRandom(item.tokenIds)
    const tokenPrice = toUint256(item.price)
    const tokenAddress = item.id
    const marketAddress = marketContract.getAddress(chainId)

    // __EFFECTS <React.Hooks>
    useEffect(() => {
        async function getBalance() {
            const ether = getEtherProvider()
            if (ether) {
                const balance = await ether.getBalance(account)
                setAllowance(bigNumber(balance).toNumber())
            }
        }

        async function getAllowance() {
            const { methods } = coinContract.build(chainId || 97)
            const res = await methods.allowance(account, marketAddress).call()
            setAllowance(bigNumber(res).toNumber())
        }

        if (account) {
            if (isBNB) getBalance()
            else getAllowance()

            console.log('RNG TokenId:', tokenId)
        }
    }, [account])

    // __FUNCTIONS
    const handleAction = useCallback(async (): Promise<void> => {
        if (!account) return void 0
        if (isBNB && allowance < tokenPrice.toNumber()) return void 0
        if (allowance < tokenPrice.toNumber()) return handleApprove()

        setWait(true)

        try {
            const { methods } = marketContract.build(chainId)

            let res: any = void 0
            if (isBNB) {
                res = await methods.buyWithBNB(tokenAddress, tokenId).send({
                    from: account,
                    value: tokenPrice.toString(),
                    gas: 199e3
                })
            } else {
                res = await methods.buy(tokenAddress, tokenId).send({ from: account })
            }

            if (res.status) {
                assetService.buy({
                    postId: tokenId,
                    nftAddress: tokenAddress,
                    account,
                    mode: 'buy'
                })
                modal(<ModalPurchase name={item.name} />)
            }

            console.log('Action Checkout:', res)
        } catch (err: any) {
            dialog({
                title: 'Transaction Error.',
                message: err.message || 'Transaction has been reverted!'
            })
            console.error('Action Checkout:', err)
        }

        setWait(false)
    }, [account, tokenPrice])

    const handleApprove = useCallback(async (): Promise<void> => {
        setWait(true)

        try {
            const { methods } = coinContract.build(chainId || 97)
            const res: any = await methods.approve(marketAddress, tokenPrice.toString()).send({ from: account })
            if (res.status) {
                setAllowance(tokenPrice.toNumber())
                notice.success({
                    duration: 3,
                    message: 'Transaction Receipt',
                    description: `Approve amount: ${item.price} ${upperCase(item.currency)}`
                })
            }
        } catch (err) {
            console.error('handleApprove', err)
        }

        setWait(false)
    }, [account, tokenPrice])

    // __RENDER
    return (
        <div className='ui--asset-modal checkout'>
            <h3 className='h3'>item</h3>

            <div className='ul'>
                <div className='item'>
                    <MediaComponent media={item.image} autoPlay />
                    <div className='meta' title={item.name}>
                        <p className='name'>{item.name}</p>
                        <p className='desc'>Untitled Collection</p>
                    </div>
                    <CurrencyComponent currency={item.currency} amount={item.price} size='large' />
                </div>
            </div>

            <div className='summary'>
                <h3 className='h3'>total</h3>
                <CurrencyComponent currency={item.currency} amount={item.price} size='large' />
            </div>

            <Input.Checkbox
                key='.agree'
                name='agree'
                label='By checking this box, I agree to winwinwin term of service.'
                register={() => ({ onChange: ({ target }: any) => setAgree(target.checked) })}
            />

            <div className='ui--asset-modal-footer'>
                <button className='btn btn-dark btn-checkout' disabled={!agree || wait} onClick={handleAction}>
                    <span className='text'>
                        {wait
                            ? 'Awaiting...'
                            : allowance < tokenPrice.toNumber()
                                ? isBNB
                                    ? 'Insufficient BNB balance'
                                    : `Approve ${upperCase(item.currency)}`
                                : 'Checkout'}
                    </span>
                </button>
            </div>
        </div>
    )
}

export function ModalPurchase({ name }: { name: string }) {
    // __STATE <React.Hooks>
    const router = useRouter()

    // __EFFECTS <React.Hooks>
    useEffect(() => {
        loader('on')
        setTimeout(() => {
            router.push({ pathname: '/profile' })
        }, 3e3)
    }, [])

    // __RENDER
    return (
        <div className='ui--asset-modal purchase'>
            <span className='icon bi bi-check-circle-fill'></span>
            <h2 className='h2'>Your purchase has processed!</h2>
            <h6 className='h6'>You just purchased ({name})</h6>
        </div>
    )
}

function createContractInstance(_contract: { name?: string, symbol?: string, address: string, abi: any }) {
    const contract = ({
        ..._contract,
        contract: null,
        error: process.browser ? null : "Only supported on browser context"
    } as any);

    if (process.browser) {
        if (!window.ethereum) { contract.error = "Web3 ethereum object not existed" }
        else {
            const { address, abi } = _contract
            const provider = new ethers.providers.Web3Provider(window.ethereum)
            provider.send("eth_requestAccounts", []).then((/* x: any */) => {
                const signer = provider.getSigner();
                contract.contract = new Contract(address, abi, signer);
            })
        }

    }
    return contract
}


function getERC20tokenContract(contract_config: ContractConfig, chainId: string | number) {
    console.log("getERC20tokenContract", contract_config)
    const { name, symbol, address: _address } = contract_config
    const address = _address[chainIdMatcher(chainId)]
    const abi = ERC20.abi
    return createContractInstance({ name, symbol, address, abi })
}

function chainIdMatcher(chainId: string | number) {
    return chainId.toString()
}

function getNFTregistryContract() {
    const name = "NFT Registry"
    // const address = "0x262451c4BFf59747BbCFEb03c5490611BF9Ba635" // Testnet Old
    const address = "0x7ca07b1bbe7e78949c3efeeb23f3429e4d3fa3cf" // Mainnet Current
    const abi = [{ "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "previousOwner", "type": "address" }, { "indexed": true, "internalType": "address", "name": "newOwner", "type": "address" }], "name": "OwnershipTransferred", "type": "event" }, { "inputs": [{ "internalType": "address", "name": "erc20_address", "type": "address" }], "name": "getERC20token", "outputs": [{ "components": [{ "internalType": "address", "name": "contract_address", "type": "address" }, { "internalType": "string", "name": "symbol", "type": "string" }, { "internalType": "bool", "name": "active", "type": "bool" }, { "internalType": "string", "name": "meta", "type": "string" }], "internalType": "struct I_NFT_Registry.ERC20Token", "name": "", "type": "tuple" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "erc721_address", "type": "address" }], "name": "getERC721token", "outputs": [{ "components": [{ "internalType": "address", "name": "contract_address", "type": "address" }, { "internalType": "string", "name": "name", "type": "string" }, { "internalType": "uint256", "name": "max_supply", "type": "uint256" }, { "internalType": "uint256[]", "name": "max_supply_history", "type": "uint256[]" }, { "internalType": "address", "name": "owner", "type": "address" }, { "internalType": "address", "name": "payee", "type": "address" }, { "internalType": "bool", "name": "active", "type": "bool" }, { "internalType": "string", "name": "meta", "type": "string" }], "internalType": "struct I_NFT_Registry.ERC721Token", "name": "", "type": "tuple" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "erc721_address", "type": "address" }, { "internalType": "address", "name": "erc20_address", "type": "address" }], "name": "getExchangeRateForNFTcollection", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "erc721_address", "type": "address" }, { "internalType": "uint256", "name": "serial_no", "type": "uint256" }, { "internalType": "address", "name": "erc20_address", "type": "address" }], "name": "getExchangeRateForSpecificNFT", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "erc20_address", "type": "address" }], "name": "getMinimumExchangeRate", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "erc721_address", "type": "address" }, { "internalType": "uint256", "name": "serial_no", "type": "uint256" }], "name": "getNFTslotState", "outputs": [{ "components": [{ "internalType": "bool", "name": "exists", "type": "bool" }, { "internalType": "uint256", "name": "serial_no", "type": "uint256" }, { "internalType": "string", "name": "status", "type": "string" }, { "internalType": "uint256", "name": "timestamp", "type": "uint256" }, { "internalType": "string", "name": "remark", "type": "string" }, { "internalType": "string", "name": "meta", "type": "string" }, { "internalType": "address", "name": "operator", "type": "address" }], "internalType": "struct I_NFT_Registry.SlotState", "name": "", "type": "tuple" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "owner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }]
    return createContractInstance({ name, address, abi })
}

function getNFTswapContract() {
    const name = "NFT Swap"
    // const address = "0x262451c4BFf59747BbCFEb03c5490611BF9Ba635" // Testnet Old
    // const address = "0xb163A78b8169B862D1111F3AcC3B3b169d36c23e" // Mainnet Current
    const address = "0x19A330E00B1dedf395Cf22DA61949c330dD6d243" // Mainnet Current V0.2.1
    const abi = [{ "inputs": [{ "internalType": "address", "name": "buyer", "type": "address", "indexed": true }, { "indexed": true, "internalType": "address", "name": "erc721_address", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "serial_no", "type": "uint256" }, { "indexed": true, "internalType": "address", "name": "erc20_address", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }], "name": "NFTswap", "type": "event", "anonymous": false }, { "inputs": [], "name": "$nft_registry", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "owner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "erc721_address", "type": "address" }, { "internalType": "uint256", "name": "serial_no", "type": "uint256" }, { "internalType": "address", "name": "erc20_address", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }, { "internalType": "string", "name": "remark", "type": "string" }, { "internalType": "string", "name": "meta", "type": "string" }], "name": "swapNFT", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "erc721_address", "type": "address" }, { "internalType": "uint256", "name": "serial_no", "type": "uint256" }, { "internalType": "string", "name": "remark", "type": "string" }, { "internalType": "string", "name": "meta", "type": "string" }], "name": "swapNFTbyNative", "outputs": [], "stateMutability": "payable", "type": "function" }]
    return createContractInstance({ name, address, abi })
}

function getNFTContract(contract_config: ERC721ContractConfig) {
    const { name, symbol, address } = contract_config
    const abi = ERC721.abi
    return createContractInstance({ name, symbol, address, abi })
}


// import { setDoc } from "firebase/firestore";

async function getOneDoc(collection: string, id: string) {
    const { db } = firebaseApp
    const docRef = doc((db as any), collection, id);
    const docSnap = await getDoc(docRef);
    const data = docSnap.data();
    return data as any
}

function randomPick(array: any[]) {
    return array[Math.floor(Math.random() * array.length)];
}

function shuffle(array: any[]) {
    let currentIndex = array.length, randomIndex;

    // While there remain elements to shuffle...
    while (currentIndex != 0) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }

    return array;
}

const getNFTtokensAvailable = async (id: string) => {
    const doc = await getOneDoc("nft_tokens_list:available", id);
    console.log(doc);
    const { LIST, /* TESTLIST */ } = doc;

    const availableList = shuffle([...new Set(LIST)])
    return availableList
}