"use client";

export default function Header() {

  async function logout() {

    await fetch("/api/logout", {

      method: "POST"

    });

    window.location.href = "/login";

  }

  return (

    <div className="bg-white shadow rounded-xl h-16 px-6 flex justify-between items-center mb-6">

      <div>

        <h1 className="font-bold text-xl">

          PT. MITRA GARAM BOGATAMA

        </h1>

      </div>

      <button

        onClick={logout}

        className="bg-red-600 text-white px-5 py-2 rounded"

      >

        Logout

      </button>

    </div>

  );

}