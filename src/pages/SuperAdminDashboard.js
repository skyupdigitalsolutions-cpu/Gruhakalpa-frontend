import { useEffect, useState } from "react";
import axiosInstance from "../api/axios";
import { Header } from "../components/Header";
import BookingOverview from "../components/BookingOverview";
import { UpcomingPaymentsWidget } from "../components/UpcomingPaymentsWidget";
import PaymentTable from "../components/PaymentTable";

export function SuperAdminDashboard() {
  const [totalMembers, setTotalMembers] = useState(0);
  const [totalsitebookings, setTotalSiteBookings] = useState(0);
  const [totalreceipts, setTotalReceipts] = useState(0);
  const [totalamount, setTotalAmount] = useState(0);
  const [totalPenalty, setTotalPenalty] = useState(0);
  const [cancelledCount, setCancelledCount] = useState(0);

  useEffect(() => {
    axiosInstance.get("/members").then((res) => {
      setTotalMembers((res.data.data || []).length);
    });
  }, []);

  useEffect(() => {
    axiosInstance.get("/sitebookings").then((res) => {
      const bookings = res.data || [];
      setTotalSiteBookings(bookings.length);
      const cancelled = bookings.filter((b) => b.cancelled);
      setCancelledCount(cancelled.length);
      setTotalPenalty(
        cancelled.reduce(
          (sum, b) => sum + Number(b.cancellationPenalty || 0),
          0,
        ),
      );
    });
  }, []);

  useEffect(() => {
    axiosInstance.get("/receipts").then((res) => {
      const receipts = res.data.data || [];
      setTotalReceipts(receipts.length);
      const total = receipts.reduce(
        (sum, r) => sum + Number(r.amountpaid || 0),
        0,
      );
      setTotalAmount(total);
    });
  }, []);

  return (
    <div>
      <Header />
      <div className="px-[70px] py-10">
        <div className="text-[24px] font-semibold mb-6">Overview</div>

        <div className="flex flex-col lg:flex-row gap-[20px] pt-[24px]">
          <div className="flex-1 min-w-[210px] min-h-[119px] bg-[#FFFF] shadow-[0_-2px_4px_-1px_rgba(0,0,0,0.1),0_4px_5px_-1px_rgba(0,0,0,0.1)] rounded-xl">
            <div className="px-[20px] flex py-[16px]">
              <div className="h-[57px] w-[4px] bg-[#08A25C] rounded-lg"></div>
              <div className="px-[20px]">
                <div className="text-[18px] text-[#EF742C] font-semibold">
                  Total Member
                </div>
                <div className="font-bold text-[30px]">
                  {totalMembers}
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-[210px] min-h-[119px] bg-[#FFFF] shadow-[0_-2px_4px_-1px_rgba(0,0,0,0.1),0_4px_5px_-1px_rgba(0,0,0,0.1)] rounded-xl">
            <div className="px-[20px] flex py-[16px]">
              <div className="h-[57px] w-[4px] bg-[#08A25C] rounded-lg"></div>
              <div className="px-[20px]">
                <div className="text-[18px] text-[#EF742C] font-semibold">
                  Site Booking
                </div>
                <div className="font-bold  text-[30px]">
                  {totalsitebookings}
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-[210px] min-h-[119px] bg-[#FFFF] shadow-[0_-2px_4px_-1px_rgba(0,0,0,0.1),0_4px_5px_-1px_rgba(0,0,0,0.1)] rounded-xl">
            <div className="px-[20px] flex py-[16px]">
              <div className="h-[57px] w-[4px] bg-[#08A25C] rounded-lg"></div>
              <div className="px-[20px]">
                <div className="text-[18px] font-semibold text-[#EF742C]">
                  Total Receipt
                </div>
                <div className="font-bold text-[30px]">
                  {totalreceipts}
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-[210px] min-h-[119px] bg-[#FFFF] shadow-[0_-2px_4px_-1px_rgba(0,0,0,0.1),0_4px_5px_-1px_rgba(0,0,0,0.1)] rounded-xl">
            <div className="px-[20px] flex py-[16px]">
              <div className="h-[57px] w-[4px] bg-[#FF5A5A] rounded-lg"></div>
              <div className="px-[20px]">
                <div className="text-[18px] font-semibold text-[#ef2c2c]">
                  Penalty Collected
                </div>
                <div className="font-bold text-[24px] ">
                  ₹{totalPenalty.toLocaleString("en-IN")}
                </div>
                <div className="text-[12px] text-white/80">
                  {cancelledCount} cancelled
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        <UpcomingPaymentsWidget prefix="/superadmin" />
      </div>

      <div className="flex">
        <BookingOverview />
      </div>
      <div>
        <PaymentTable/>
      </div>
    </div>
  );
}
