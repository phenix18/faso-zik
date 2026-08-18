"use client";

import { Provider } from "react-redux";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "react-hot-toast";
import { store } from "./store";

export default function Providers({ children }) {
  return (
    <SessionProvider>
      <Provider store={store}>
        {children}
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: { background: "#14181D", color: "#F4F6F8", border: "1px solid #232A32" },
          }}
        />
      </Provider>
    </SessionProvider>
  );
}
