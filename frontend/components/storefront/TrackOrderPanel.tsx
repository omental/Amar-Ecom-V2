"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { PackageSearch } from "lucide-react";

export function TrackOrderPanel() {
  const [trackingInput, setTrackingInput] = useState("");
  const [submitted, setSubmitted] = useState("");

  return (
    <section className="mx-auto grid w-full max-w-3xl gap-5">
      <div className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          Track Order
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-3xl">
          Check your order with phone number or order ID.
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          This page stays intentionally simple. No fake order history is shown here.
        </p>

        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted(trackingInput.trim());
          }}
        >
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-900">
              Order ID or phone number
            </span>
            <input
              value={trackingInput}
              onChange={(event) => setTrackingInput(event.target.value)}
              placeholder="ORD-1024 or 01XXXXXXXXX"
              className="w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[var(--store-accent)]"
            />
          </label>
          <motion.button
            type="submit"
            whileTap={{ scale: 0.98 }}
            className="store-primary-button w-full justify-center"
          >
            <PackageSearch className="h-4 w-4" />
            <span>{"\u0985\u09B0\u09CD\u09A1\u09BE\u09B0 \u0996\u09C1\u0981\u099C\u09C1\u09A8"}</span>
          </motion.button>
        </form>
      </div>

      <div className="rounded-[22px] border border-slate-200 bg-white p-5 text-sm leading-7 text-slate-600 shadow-sm">
        {submitted
          ? `Tracking request received for "${submitted}". Connect this form to a public order lookup endpoint when the live tracking workflow is ready.`
          : "Enter an order ID or phone number to prepare a public tracking lookup. This foundation intentionally avoids fake shipment data."}
      </div>
    </section>
  );
}
