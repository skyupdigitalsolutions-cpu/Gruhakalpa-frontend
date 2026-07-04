/* eslint-disable */


export function LoginHeader() {
  return (
    <div className="flex justify-between px-[80px] items-center h-[90px] lg:h-[100px] bg-[#ffff] shadow-md">
      <div className="flex items-center shado">
        <img src="/images/gruhakalpa_logo.png" alt="" className="h-[80px]" />

        <div className="ml-[25px]"></div>
      </div>

      {/* ===== RIGHT SIDE BUTTON AREA ===== */}
      <div className="flex gap-3">
        {/* <Link to="#" className="text-[#6952A9] py-[12px] px-4 rounded-full bg-[#FFFF] font-semibold text-[16px] no-underline">
            Admin Login
          </Link> */}
      </div>
    </div>
  );
}