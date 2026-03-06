import React from "react";
import { statusColors } from "../utils/statusColors";

export default function StatusBadge({ status }) {
    return (
        <span
            className={`px-3 py-1 rounded-full text-xs font-semibold inline-block hover:scale-105 transition-transform duration-200 cursor-default ${statusColors[status] || "bg-gray-100 text-gray-800"
                }`}
        >
            {status}
        </span>
    );
}
