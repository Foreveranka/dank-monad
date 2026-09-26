import type {Metadata} from 'next';
import {Providers} from '@/components/shell';
import './globals.css';
export const metadata:Metadata={title:'DANK — Reputation-based credit on Monad',description:'Unsecured credit on Monad based on wallet history, DeFi activity and reputation. Open testnet prototype.',icons:{icon:'/favicon.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body><Providers>{children}</Providers></body></html>}
