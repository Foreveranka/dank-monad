// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/access/Ownable2Step.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import './Calendar.sol';
/// @notice Invite-only, closed-cohort TESTNET credit prototype. Not production lending software.
contract Dank is Ownable2Step, ReentrancyGuard {
 using SafeERC20 for IERC20;
 IERC20 public immutable token;
 uint256 constant WAD=1e18;
 uint256 public constant APR_BPS=1500;
 uint256 public constant GRACE=3 days;
 uint256 public constant DEFAULT_AFTER=30 days;
 uint256 public constant LOSS_AFTER=90 days;
 uint256 public constant MAX_LOAN=1000e6;
 uint256 public constant MAX_BACKINGS=8;
 bool public paused;
 enum Phase {Funding,Lending,Settled}
 Phase public phase;
 struct Member {address wallet;uint256 score;uint256 creditLimit;uint256 capacity;uint256 usedCapacity;uint256 activeLoan;uint256 strikes;bool enabled;}
 mapping(bytes32=>Member) public members;
 mapping(address=>bytes32) public memberOf;
 mapping(bytes32=>bool) public usedEvidence;
 mapping(bytes32=>uint256) public hackathonScore;
 mapping(bytes32=>bool) public hackathonWinClaimed;
 mapping(bytes32=>uint256) public walletScore;
 mapping(bytes32=>uint256) public walletScoreExpires;
 mapping(bytes32=>bool) public usedWalletAssessment;
 event WalletScoreUpdated(bytes32 indexed memberId,bytes32 indexed assessmentHash,uint256 points,uint256 expires);

 mapping(bytes32=>uint256[]) private backingLoans;
 struct Installment{uint256 due;uint256 principal;uint256 interest;uint256 penalty;uint256 chargedDay;}
 struct Loan{bytes32 borrower;uint256 principal;uint256 outstanding;uint256 months;uint256 createdAt;uint256 activatedAt;uint256 coverage;uint256 penaltyCharged;bool closed;bool lossRecognized;bool defaultRecorded;}
 mapping(uint256=>Loan) public loans;
 mapping(uint256=>Installment[]) private schedules;
 mapping(uint256=>bytes32[]) private guarantors;
 mapping(uint256=>mapping(bytes32=>uint256)) public contributions;
 uint256 public nextLoanId=1;
 uint256 public outstandingPrincipal;
 uint256 public totalDeposits;
 mapping(address=>uint256) public deposits;
 mapping(address=>uint256) public claimed;
 uint256 public cumulativeDistributable;
 event MemberEnrolled(bytes32 indexed memberId,address indexed wallet);
 event EvidenceVerified(bytes32 indexed memberId,bytes32 indexed evidenceId,uint256 points);
 event LoanRequested(uint256 indexed loanId,bytes32 indexed borrower,uint256 principal,uint256 months);
 event Guaranteed(uint256 indexed loanId,bytes32 indexed guarantor,uint256 contribution);
 event LoanActivated(uint256 indexed loanId,address indexed borrower,uint256 amount);
 event Payment(uint256 indexed loanId,address indexed payer,uint256 amount,uint256 principalPaid);
 event DefaultRecorded(uint256 indexed loanId);
 event LossRecognized(uint256 indexed loanId,uint256 principal);
 event CapitalDeposited(address indexed provider,uint256 amount);
 event CapitalClaimed(address indexed provider,uint256 amount);
 event PhaseChanged(Phase phase);
 constructor(address asset,address admin) Ownable(admin){require(block.chainid==10143||block.chainid==31337,'Testnet only');require(asset.code.length>0,'Token missing');token=IERC20(asset);}
 function enroll(bytes32 id,address wallet) external onlyOwner {require(id!=0&&wallet!=address(0),'Bad identity');require(members[id].wallet==address(0)&&memberOf[wallet]==0,'Exists');members[id]=Member(wallet,0,0,0,0,0,0,true);memberOf[wallet]=id;emit MemberEnrolled(id,wallet);}
 /// @notice rank 0 = participation, 1/2/3 = placement. Participation counts once. The first verified podium result locks this component.
 function verifyAchievement(bytes32 id,bytes32 evidenceId,uint8 rank) external onlyOwner {
  require(members[id].wallet!=address(0)&&!usedEvidence[evidenceId]&&evidenceId!=0&&rank<=3,'Invalid evidence');
  usedEvidence[evidenceId]=true;
  uint256 best=rank==1?20:rank==2?10:rank==3?5:1;
  uint256 previous=hackathonScore[id];uint256 added;
  if(!hackathonWinClaimed[id]){if(rank>0)hackathonWinClaimed[id]=true;if(best>previous){added=best-previous;hackathonScore[id]=best;members[id].score+=added;}}
  emit EvidenceVerified(id,evidenceId,added);
 }

 /// @notice Trusted pilot reviewer attests a full mainnet assessment, capped at 80 and valid at most 7 days.
 /// A refresh replaces the prior wallet score; it never accumulates points or clears defaults.
 function updateWalletScore(bytes32 id,uint256 points,bytes32 assessmentHash,uint256 expires) external onlyOwner {
  Member storage m=members[id];require(m.wallet!=address(0)&&points<=80&&assessmentHash!=0&&!usedWalletAssessment[assessmentHash],'Invalid assessment');
  require(expires>block.timestamp&&expires<=block.timestamp+7 days,'Invalid expiry');
  usedWalletAssessment[assessmentHash]=true;walletScore[id]=points;walletScoreExpires[id]=expires;
  m.score=hackathonScore[id]+points;emit WalletScoreUpdated(id,assessmentHash,points,expires);
 }
 function scoreFresh(bytes32 id) public view returns(bool){return walletScore[id]==0||walletScoreExpires[id]>=block.timestamp;}
 function setLimits(bytes32 id,uint256 limit,uint256 capacity) external onlyOwner {Member storage m=members[id];require(m.wallet!=address(0)&&limit<=MAX_LOAN&&capacity<=MAX_LOAN&&capacity>=m.usedCapacity,'Bad limits');require(m.score>0||limit==0,'Evidence required');m.creditLimit=limit;m.capacity=capacity;}
 function setEnabled(bytes32 id,bool enabled) external onlyOwner {require(members[id].wallet!=address(0),'Unknown member');members[id].enabled=enabled;}
 function setPaused(bool value) external onlyOwner {paused=value;}
 /// @notice Both wallets consent via two transactions; all debt remains on the same member ID.
 mapping(bytes32=>address) public pendingWallet;
 function proposeWallet(address newWallet) external {bytes32 id=memberOf[msg.sender];require(id!=0&&newWallet!=address(0)&&memberOf[newWallet]==0,'Invalid wallet');pendingWallet[id]=newWallet;}
 function acceptWallet(bytes32 id) external {require(pendingWallet[id]==msg.sender&&memberOf[msg.sender]==0,'Not proposed');delete memberOf[members[id].wallet];members[id].wallet=msg.sender;memberOf[msg.sender]=id;delete pendingWallet[id];}
 function isOverdue(uint256 loanId) public view returns(bool){Loan storage l=loans[loanId];if(l.activatedAt==0||l.closed)return false;Installment[] storage s=schedules[loanId];for(uint256 i;i<s.length;i++)if(s[i].principal+s[i].interest+s[i].penalty>0&&block.timestamp>s[i].due+GRACE)return true;return false;}
 function canBorrow(bytes32 id) public view returns(bool){Member storage m=members[id];if(id==0||!scoreFresh(id)||!m.enabled||m.strikes>0||m.activeLoan!=0)return false;uint256[] storage b=backingLoans[id];for(uint256 i;i<b.length;i++)if(isOverdue(b[i]))return false;return true;}
 function canGuarantee(bytes32 id) public view returns(bool){Member storage m=members[id];if(id==0||!scoreFresh(id)||!m.enabled||m.strikes>0)return false;if(m.activeLoan!=0&&isOverdue(m.activeLoan))return false;uint256[] storage b=backingLoans[id];for(uint256 i;i<b.length;i++)if(isOverdue(b[i]))return false;return true;}
 function requestLoan(uint256 amount,uint256 months_) external returns(uint256 id){bytes32 member=memberOf[msg.sender];require(phase==Phase.Lending&&!paused&&canBorrow(member),'Not eligible');require(amount>=10e6&&amount<=members[member].creditLimit&&amount<=MAX_LOAN&&months_>=1&&months_<=12,'Invalid terms');id=nextLoanId++;loans[id]=Loan(member,amount,amount,months_,block.timestamp,0,0,0,false,false,false);members[member].activeLoan=id;emit LoanRequested(id,member,amount,months_);}
 function guarantee(uint256 id,uint256 amount) external {Loan storage l=loans[id];bytes32 member=memberOf[msg.sender];require(!paused&&phase==Phase.Lending&&l.createdAt>0&&!l.closed&&l.activatedAt==0&&block.timestamp<=l.createdAt+7 days,'Request expired');require(member!=l.borrower&&canGuarantee(member),'Ineligible guarantor');Member storage m=members[member];uint256 cap=m.score>=40?500e6:m.score>=20?200e6:80e6;require(amount>0&&amount<=cap&&amount<=m.capacity-m.usedCapacity&&amount<=l.principal-l.coverage,'Capacity exceeded');require(contributions[id][member]==0&&backingLoans[member].length<MAX_BACKINGS&&guarantors[id].length<8,'Duplicate or full');contributions[id][member]=amount;guarantors[id].push(member);backingLoans[member].push(id);m.usedCapacity+=amount;l.coverage+=amount;emit Guaranteed(id,member,amount);}
 function cancelRequest(uint256 id) external {Loan storage l=loans[id];require(l.createdAt>0&&l.activatedAt==0&&!l.closed,'Not request');require(memberOf[msg.sender]==l.borrower||block.timestamp>l.createdAt+7 days,'Not authorized');l.closed=true;members[l.borrower].activeLoan=0;_release(id);}
 function activate(uint256 id) external nonReentrant {Loan storage l=loans[id];Member storage m=members[l.borrower];require(!paused&&phase==Phase.Lending&&memberOf[msg.sender]==l.borrower&&m.enabled&&m.strikes==0&&scoreFresh(l.borrower),'Not eligible');require(l.createdAt>0&&!l.closed&&l.activatedAt==0&&block.timestamp<=l.createdAt+7 days,'Invalid request');require(l.principal<=m.creditLimit&&l.coverage==l.principal,'Insufficient support');uint256[] storage backs=backingLoans[l.borrower];for(uint256 i;i<backs.length;i++)require(!isOverdue(backs[i]),'Guarantor blocked');bytes32[] storage gs=guarantors[id];for(uint256 i;i<gs.length;i++)require(canGuarantee(gs[i]),'Support invalid');require(token.balanceOf(address(this))>=l.principal,'Pool liquidity');l.activatedAt=block.timestamp;outstandingPrincipal+=l.principal;uint256 remain=l.principal;uint256 monthly=monthlyPayment(l.principal,l.months);for(uint256 i;i<l.months;i++){uint256 interest=remain*APR_BPS/120000;uint256 principal=i+1==l.months?remain:monthly-interest;remain-=principal;schedules[id].push(Installment(Calendar.addMonths(block.timestamp,i+1),principal,interest,0,0));}token.safeTransfer(msg.sender,l.principal);emit LoanActivated(id,msg.sender,l.principal);}
 function pow(uint256 x,uint256 n) internal pure returns(uint256 z){z=WAD;while(n>0){if(n&1!=0)z=z*x/WAD;n>>=1;if(n>0)x=x*x/WAD;}}
 function monthlyPayment(uint256 principal,uint256 months_) public pure returns(uint256){require(months_>=1&&months_<=12,'Term');uint256 r=APR_BPS*WAD/120000;uint256 factor=pow(WAD+r,months_);return principal*r*factor/(factor-WAD)/WAD;}
 function _extra(Installment memory s) internal view returns(uint256,uint256){if(block.timestamp<=s.due)return(0,0);uint256 day=(block.timestamp-s.due)/1 days;if(day<=s.chargedDay)return(0,day);uint256 elapsed=day-s.chargedDay;if(elapsed>3650)elapsed=3650;uint256 base=s.principal+s.interest+s.penalty;uint256 increased=base*pow(WAD+WAD*20/100/365,elapsed)/WAD;return(increased-base,day);}
 function _accrue(uint256 id) internal {Loan storage l=loans[id];Installment[] storage s=schedules[id];for(uint256 i;i<s.length;i++){(uint256 extra,uint256 day)=_extra(s[i]);uint256 room=l.principal-l.penaltyCharged;if(extra>room)extra=room;s[i].penalty+=extra;l.penaltyCharged+=extra;s[i].chargedDay=day;}}
 function getSchedule(uint256 id) external view returns(Installment[] memory s){s=schedules[id];uint256 room=loans[id].principal-loans[id].penaltyCharged;for(uint256 i;i<s.length;i++){(uint256 extra,)=_extra(s[i]);if(extra>room)extra=room;s[i].penalty+=extra;room-=extra;}}
 function getGuarantors(uint256 id) external view returns(bytes32[] memory){return guarantors[id];}
 function getBackings(bytes32 id) external view returns(uint256[] memory){return backingLoans[id];}
 function dueNow(uint256 id) public view returns(uint256 total){Installment[] storage s=schedules[id];uint256 room=loans[id].principal-loans[id].penaltyCharged;for(uint256 i;i<s.length;i++)if(block.timestamp>=s[i].due){(uint256 extra,)=_extra(s[i]);if(extra>room)extra=room;room-=extra;total+=s[i].principal+s[i].interest+s[i].penalty+extra;}}
 function repay(uint256 id,uint256 amount) external nonReentrant {Loan storage l=loans[id];require(l.activatedAt>0&&!l.closed&&amount>0&&amount<=dueNow(id),'Invalid payment');_recordDefault(id);_accrue(id);uint256 left=amount;uint256 principalPaid;Installment[] storage s=schedules[id];for(uint256 i;i<s.length&&left>0;i++){if(block.timestamp<s[i].due)break;uint256 pay=left<s[i].penalty?left:s[i].penalty;s[i].penalty-=pay;left-=pay;pay=left<s[i].interest?left:s[i].interest;s[i].interest-=pay;left-=pay;pay=left<s[i].principal?left:s[i].principal;s[i].principal-=pay;left-=pay;principalPaid+=pay;}require(left==0,'Allocation');_paid(id,amount,principalPaid);}
 function payoff(uint256 id) public view returns(uint256 total){Loan storage l=loans[id];if(l.closed||l.activatedAt==0)return 0;total=l.outstanding;Installment[] storage s=schedules[id];uint256 room=l.principal-l.penaltyCharged;bool current;for(uint256 i;i<s.length;i++){(uint256 extra,)=_extra(s[i]);if(extra>room)extra=room;room-=extra;total+=s[i].penalty+extra;if(block.timestamp>=s[i].due)total+=s[i].interest;else if(!current){current=true;uint256 start=i==0?l.activatedAt:s[i-1].due;total+=s[i].interest*(block.timestamp-start)/(s[i].due-start);}}}
 function repayAll(uint256 id,uint256 maxAmount) external nonReentrant {Loan storage l=loans[id];require(l.activatedAt>0&&!l.closed,'No loan');uint256 amount=payoff(id);require(amount<=maxAmount,'Quote changed');_recordDefault(id);uint256 principal=l.outstanding;delete schedules[id];_paid(id,amount,principal);}
 function _paid(uint256 id,uint256 amount,uint256 principal) internal {Loan storage l=loans[id];l.outstanding-=principal;if(!l.lossRecognized)outstandingPrincipal-=principal;if(l.outstanding==0){l.closed=true;members[l.borrower].activeLoan=0;_release(id);}token.safeTransferFrom(msg.sender,address(this),amount);if(phase==Phase.Settled)cumulativeDistributable+=amount;emit Payment(id,msg.sender,amount,principal);}
 function _release(uint256 id) internal {bytes32[] storage gs=guarantors[id];for(uint256 i;i<gs.length;i++){bytes32 g=gs[i];members[g].usedCapacity-=contributions[id][g];uint256[] storage list=backingLoans[g];for(uint256 j;j<list.length;j++)if(list[j]==id){list[j]=list[list.length-1];list.pop();break;}}}
 function recordDefault(uint256 id) external {_recordDefault(id);}
 function _recordDefault(uint256 id) internal {Loan storage l=loans[id];if(l.activatedAt==0||l.closed||l.defaultRecorded)return;Installment[] storage s=schedules[id];for(uint256 i;i<s.length;i++)if(s[i].principal+s[i].interest+s[i].penalty>0&&block.timestamp>s[i].due+DEFAULT_AFTER){l.defaultRecorded=true;members[l.borrower].strikes++;bytes32[] storage gs=guarantors[id];for(uint256 j;j<gs.length;j++)members[gs[j]].strikes++;emit DefaultRecorded(id);return;}}
 function recognizeLoss(uint256 id) external onlyOwner {Loan storage l=loans[id];require(l.activatedAt>0&&!l.closed&&!l.lossRecognized,'Invalid loss');Installment[] storage s=schedules[id];bool eligible;for(uint256 i;i<s.length;i++)if(s[i].principal+s[i].interest+s[i].penalty>0&&block.timestamp>s[i].due+LOSS_AFTER)eligible=true;require(eligible,'Too early');_recordDefault(id);l.lossRecognized=true;outstandingPrincipal-=l.outstanding;emit LossRecognized(id,l.outstanding);}
 function depositCapital(uint256 amount) external nonReentrant {require(phase==Phase.Funding&&amount>0&&memberOf[msg.sender]!=0&&members[memberOf[msg.sender]].enabled,'Funding closed');deposits[msg.sender]+=amount;totalDeposits+=amount;token.safeTransferFrom(msg.sender,address(this),amount);emit CapitalDeposited(msg.sender,amount);}
 function startLending() external onlyOwner {require(phase==Phase.Funding&&totalDeposits>0,'No capital');phase=Phase.Lending;emit PhaseChanged(phase);}
 function settleCohort() external onlyOwner {require(phase==Phase.Lending&&outstandingPrincipal==0,'Outstanding loans');phase=Phase.Settled;cumulativeDistributable=token.balanceOf(address(this));emit PhaseChanged(phase);}
 function claimCapital() external nonReentrant {require(phase==Phase.Settled,'Not settled');uint256 entitled=cumulativeDistributable*deposits[msg.sender]/totalDeposits;uint256 amount=entitled-claimed[msg.sender];require(amount>0,'Nothing claimable');claimed[msg.sender]=entitled;token.safeTransfer(msg.sender,amount);emit CapitalClaimed(msg.sender,amount);}
}
