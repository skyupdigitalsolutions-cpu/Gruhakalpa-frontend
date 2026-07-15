import { Link, useLocation, useNavigate } from "react-router-dom";

export function SideBar({ prefix = "" }) {
  const location = useLocation();
  const navigate = useNavigate();

  const isSuperAdmin = prefix === "/superadmin";

  const handleSignOut = () => {
    if (isSuperAdmin) {
      localStorage.removeItem("superAdminToken");
      localStorage.removeItem("superAdminData");
      navigate("/superadmin");
    } else {
      localStorage.removeItem("adminToken");
      localStorage.removeItem("adminData");
      sessionStorage.clear();
      navigate("/adminlogin");
    }
  };

  const isActive = (path, childPaths = []) => {
    if (location.pathname === path) return true;
    return childPaths.some(childPath => location.pathname === childPath);
  };

  return (
    // Fixed full-height sidebar. The logo + nav list scroll internally so the
    // Sign Out button stays pinned to the bottom no matter how many links there are.
    <div className="sidebar w-[350px] shadow-xl flex flex-col bg-[#EF742C]/90 h-screen">
      <div className="p-6 flex flex-col flex-1 min-h-0">
        <div className="flex justify-center flex-shrink-0">
          <img src="/images/gruhakalpa.webp" className="w-[150px] h-[150px]" alt="Logo" />
        </div>
        <ul className="mt-[35px] w-[326px] flex-1 min-h-0 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.55)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/50 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/70">
          <li className="mt-3">
            <Link
              to={`${prefix}/dashboard`}
              className={`flex py-1 rounded-s-xl px-4 gap-4 no-underline text-[20px] transition-all ${
                isActive(`${prefix}/dashboard`) ? "bg-[#FFFF]" : "hover:border hover:border-white"
              }`}
            >
              <img
                src={isActive(`${prefix}/dashboard`) ? "/images/green_dashboard.svg" : "/images/dashboard.svg"}
                alt="Dashboard"
              />
              <span className={isActive(`${prefix}/dashboard`) ? "text-[#456116] font-semibold" : "text-white"}>
                Dashboard
              </span>
            </Link>
          </li>

          <li className="mt-3">
            <Link
              to={`${prefix}/addmember`}
              className={`flex py-1 rounded-s-xl px-4 gap-4 no-underline text-[20px] transition-all ${
                isActive(`${prefix}/addmember`) ? "bg-[#FFFF]" : "hover:border hover:border-white"
              }`}
            >
              <img
                src={isActive(`${prefix}/addmember`) ? "/images/green_member.svg" : "/images/add_member_icon.svg"}
                alt="Add Member"
              />
              <span className={isActive(`${prefix}/addmember`) ? "text-[#456116] font-semibold" : "text-white"}>
                Add Member
              </span>
            </Link>
          </li>

          <li className="mt-3">
            <Link
              to={`${prefix}/sitebookingform`}
              className={`flex py-1 rounded-s-xl px-4 gap-4 no-underline text-[20px] transition-all ${
                isActive(`${prefix}/sitebookingform`) ? "bg-[#FFFF]" : "hover:border hover:border-white"
              }`}
            >
              <img
                src={isActive(`${prefix}/sitebookingform`) ? "/images/green_calender.svg" : "/images/calender.svg"}
                alt="Add Site Booking"
              />
              <span className={isActive(`${prefix}/sitebookingform`) ? "text-[#456116] font-semibold" : "text-white"}>
                Add Site Booking
              </span>
            </Link>
          </li>

          <li className="mt-3">
            <Link
              to={`${prefix}/fixeddeposit`}
              className={`flex py-1 rounded-s-xl px-4 gap-4 no-underline text-[20px] transition-all ${
                isActive(`${prefix}/fixeddeposit`) ? "bg-[#FFFF]" : "hover:border hover:border-white"
              }`}
            >
              <img
                src={isActive(`${prefix}/fixeddeposit`) ? "/images/shield_card_green.svg" : "/images/shield_card_white.svg"}
                alt="Add Member"
              />
              <span className={isActive(`${prefix}/fixeddeposit`) ? "text-[#456116] font-semibold" : "text-white"}>
                Fixed Deposit
              </span>
            </Link>
          </li>
          <li className="mt-3">
            <Link
              to={`${prefix}/recurringdeposit`}
              className={`flex py-1 rounded-s-xl px-4 gap-4 no-underline text-[20px] transition-all ${
                isActive(`${prefix}/recurringdeposit`) ? "bg-[#FFFF]" : "hover:border hover:border-white"
              }`}
            >
              <img
                src={isActive(`${prefix}/recurringdeposit`) ? "/images/assured_workload_green.svg" : "/images/assured_workload_white.svg"}
                alt="Add Member"
              />
              <span className={isActive(`${prefix}/recurringdeposit`) ? "text-[#456116] font-semibold" : "text-white"}>
                Recurring Deposit
              </span>
            </Link>
          </li>

          <li className="mt-3">
            <Link
              to={`${prefix}/fdcertificate`}
              className={`flex py-1 rounded-s-xl px-4 gap-4 no-underline text-[20px] transition-all ${
                isActive(`${prefix}/fdcertificate`) ? "bg-[#FFFF]" : "hover:border hover:border-white"
              }`}
            >
              <img
                src={isActive(`${prefix}/fdcertificate`) ? "/images/assignment_ind_green.svg" : "/images/assignment_ind_white.svg"}
                alt="FD Certificate"
              />
              <span className={isActive(`${prefix}/fdcertificate`) ? "text-[#456116] font-semibold" : "text-white"}>
                FD Certificate
              </span>
            </Link>
          </li>

          <li className="mt-3">
            <Link
              to={`${prefix}/receiptform`}
              className={`flex py-1 rounded-s-xl px-4 gap-4 no-underline text-[20px] transition-all ${
                isActive(`${prefix}/receiptform`) ? "bg-[#FFFF]" : "hover:border hover:border-white"
              }`}
            >
              <img
                src={isActive(`${prefix}/receiptform`) ? "/images/green_add_circle.svg" : "/images/add_circle.svg"}
                alt="Add Receipt"
              />
              <span className={isActive(`${prefix}/receiptform`) ? "text-[#456116] font-semibold" : "text-white"}>
                Add Receipt
              </span>
            </Link>
          </li>

          <li className="mt-3">
            <Link
              to={`${prefix}/report`}
              className={`flex py-1 rounded-s-xl px-4 gap-4 no-underline text-[20px] transition-all ${
                isActive(`${prefix}/report`, [`${prefix}/memberlist`, `${prefix}/sitebookinglist`, `${prefix}/receiptlist`])
                  ? "bg-[#FFFF]"
                  : "hover:border hover:border-white"
              }`}
            >
              <img
                src={
                  isActive(`${prefix}/report`, [`${prefix}/memberlist`, `${prefix}/sitebookinglist`, `${prefix}/receiptlist`])
                    ? "/images/green_account_balance_wallet.svg"
                    : "/images/bar_chart.svg"
                }
                alt="Reports"
              />
              <span
                className={
                  isActive(`${prefix}/report`, [`${prefix}/memberlist`, `${prefix}/sitebookinglist`, `${prefix}/receiptlist`])
                    ? "text-[#456116] font-semibold"
                    : "text-white"
                }
              >
                Reports
              </span>
            </Link>
          </li>

          <li className="mt-3">
            <Link
              to={`${prefix}/payments`}
              className={`flex py-1 rounded-s-xl px-4 gap-4 no-underline text-[20px] transition-all ${
                isActive(`${prefix}/payments`) ? "bg-[#FFFF]" : "hover:border hover:border-white"
              }`}
            >
              <img
                src={isActive(`${prefix}/payments`) ? "/images/green_account_balance_wallet.svg" : "/images/payment_icon.svg"}
                alt="Payments"
              />
              <span className={isActive(`${prefix}/payments`) ? "text-[#456116] font-semibold" : "text-white"}>
                Payments
              </span>
            </Link>
          </li>

          <li className="mt-3">
            <Link
              to={`${prefix}/inwardoutward`}
              className={`flex py-1 rounded-s-xl px-4 gap-4 no-underline text-[20px] transition-all ${
                isActive(`${prefix}/inwardoutward`) ? "bg-[#FFFF]" : "hover:border hover:border-white"
              }`}
            >
              <img
                src={isActive(`${prefix}/inwardoutward`) ? "/images/add_notes_green.svg" : "/images/add_notes.svg"}
                alt="Payments"
              />
              <span className={isActive(`${prefix}/inwardoutward`) ? "text-[#456116] font-semibold" : "text-white"}>
                Inward / Outward
              </span>
            </Link>
          </li>

          <li className="mt-3">
            <Link
              to={`${prefix}/payments-due`}
              className={`flex py-1 rounded-s-xl px-4 gap-4 no-underline text-[20px] transition-all ${
                isActive(`${prefix}/payments-due`) ? "bg-[#FFFF]" : "hover:border hover:border-white"
              }`}
            >
              <img
                src={isActive(`${prefix}/payments-due`) ? "/images/green_account_balance_wallet.svg" : "/images/payment_icon.svg"}
                alt="Payments Due"
              />
              <span className={isActive(`${prefix}/payments-due`) ? "text-[#456116] font-semibold" : "text-white"}>
                Payments Due
              </span>
            </Link>
          </li>

          <li className="mt-3">
            <Link
              to={`${prefix}/bankstatement`}
              className={`flex py-1 rounded-s-xl px-4 gap-4 no-underline text-[20px] transition-all ${
                isActive(`${prefix}/bankstatement`) ? "bg-[#FFFF]" : "hover:border hover:border-white"
              }`}
            >
              <img
                src={isActive(`${prefix}/bankstatement`) ? "/images/account_balance_green.svg" : "/images/account_balance_white.svg"}
                alt="Bank Statement"
              />
              <span className={isActive(`${prefix}/bankstatement`) ? "text-[#456116] font-semibold" : "text-white"}>
                Bank Statement
              </span>
            </Link>
          </li>
        </ul>
      </div>

      {/* Sign Out — stays pinned at the bottom of the fixed-height sidebar */}
      <div
        className="bg-white w-full p-4 flex-shrink-0 flex justify-center items-center cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={handleSignOut}
      >
        <img src="/images/exit.svg" alt="Sign Out" />
        <span className="text-[24px] text-dark ps-[30px]">Sign Out</span>
      </div>
    </div>
  );
}