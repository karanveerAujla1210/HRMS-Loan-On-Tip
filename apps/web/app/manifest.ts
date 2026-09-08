import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Loan On Tip HRMS",
    short_name: "LOT HRMS",
    description: "People operations platform for ACG Leasing Limited",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f4f5f9",
    theme_color: "#e85534",
    icons: [
      {
        src: "/logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}