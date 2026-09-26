// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
/// @notice Gregorian UTC calendar. Supported timestamps: 2000 through 2100.
library Calendar {
    function leap(uint256 y) internal pure returns(bool){return y%4==0&&(y%100!=0||y%400==0);}
    function daysInMonth(uint256 y,uint256 m) internal pure returns(uint256){if(m==2)return leap(y)?29:28;if(m==4||m==6||m==9||m==11)return 30;return 31;}
    function split(uint256 ts) internal pure returns(uint256 y,uint256 m,uint256 d){
        require(ts>=946684800&&ts<4133980800,'Calendar range');
        uint256 daysLeft=(ts-946684800)/1 days;y=2000;
        while(daysLeft>=(leap(y)?366:365)){daysLeft-=leap(y)?366:365;y++;}
        m=1;while(daysLeft>=daysInMonth(y,m)){daysLeft-=daysInMonth(y,m);m++;}d=daysLeft+1;
    }
    function addMonths(uint256 ts,uint256 n) internal pure returns(uint256){
        (uint256 y,uint256 m,uint256 d)=split(ts);m+=n;y+=(m-1)/12;m=(m-1)%12+1;
        uint256 last=daysInMonth(y,m);if(d>last)d=last;
        uint256 daysCount;for(uint256 a=2000;a<y;a++)daysCount+=leap(a)?366:365;
        for(uint256 a=1;a<m;a++)daysCount+=daysInMonth(y,a);
        return 946684800+(daysCount+d-1)*1 days+ts%1 days;
    }
}
