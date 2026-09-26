import type {Metadata} from 'next';
import {Providers} from '@/components/shell';
import './globals.css';
export const metadata:Metadata={title:'DANK — Builder credit on Monad',description:'Invite-only, reputation-backed credit for builders on Monad. Testnet prototype.',icons:{icon:'/favicon.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body><Providers>{children}</Providers></body></html>}
