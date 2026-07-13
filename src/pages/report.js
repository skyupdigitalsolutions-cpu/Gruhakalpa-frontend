/* eslint-disable */
import { Link, useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Header } from "../components/Header";

export function Report() {
  const location = useLocation();
  const isSuperAdmin = location.pathname.startsWith("/superadmin");
  const prefix = isSuperAdmin ? "/superadmin" : "";

  const cards = [
    {
      title: "All Member List",
      desc: "View all registered members Track active & inactive profiles Manage member details easily",
      to: `${prefix}/memberlist`,
    },
    {
      title: "Site Booking List",
      desc: "Monitor all site bookings Check booking status & dates Manage bookings in one place",
      to: `${prefix}/sitebookinglist`,
    },
    {
      title: "Receipt List",
      desc: "Access all payment receipts View paid & pending records Download and verify receipts",
      to: `${prefix}/receiptlist`,
    },
    {
      title: "Fixed Deposit List",
      desc: "View all fixed deposits Track maturity dates & interest Manage FD records easily",
      to: `${prefix}/fixeddepositlist`,
    },
    {
      title: "Recurring Deposit List",
      desc: "View all recurring deposits Track installments & maturity Manage RD records easily",
      to: `${prefix}/recurringdepositlist`,
    },
  ];

  return (
    <div>
      <Header />
      <div className="text-[24px] font-semibold px-[100px] pt-[50px] pb-[40px]">
        Overall Report
      </div>
      <div className="flex flex-wrap gap-[56px] px-[100px] pb-10">
        {cards.map((c) => (
          <div
            key={c.title}
            className="flex flex-col justify-center items-center text-center lg:w-[452px] lg:h-[307px] border-1 p-[24px] rounded-3xl border-[#EF742C]"
          >
            <img src="/images/cta.svg" className="w-[60px] h-[60px]" />
            <div className="font-bold text-[20px]">{c.title}</div>
            <div className="text-[18px] w-[280px] mt-[16px] font-inter">{c.desc}</div>
            <Link
              to={c.to}
              className="no-underline text-[16px] text-[#FFFF] bg-[#EF742C] py-[8px] px-[70px] rounded-full font-semibold mt-3 flex"
            >
              View Report <ChevronRight />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}