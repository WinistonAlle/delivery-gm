import React from "react";

type PageLoaderProps = {
  fullscreen?: boolean;
  label?: string;
};

export default function PageLoader({
  fullscreen = true,
  label = "Carregando...",
}: PageLoaderProps) {
  const wrapperClass = fullscreen
    ? "min-h-screen"
    : "min-h-[220px]";

  return (
    <div
      className={`flex ${wrapperClass} items-center justify-center bg-[radial-gradient(circle_at_top_left,#f8d7da_0%,#fdf2f2_42%,#ffffff_100%)] px-4`}
      aria-label={label}
      role="status"
    >
      <div className="gm-page-loader-frame">
        <div className="gm-page-loader-center">
          <div className="gm-page-loader-dot-1" />
          <div className="gm-page-loader-dot-2" />
          <div className="gm-page-loader-dot-3" />
        </div>
        <div className="gm-page-loader-text">{label}</div>
      </div>

      <style>{`
        .gm-page-loader-frame {
          position: relative;
          width: 220px;
          height: 220px;
        }

        .gm-page-loader-center {
          position: absolute;
          width: 220px;
          height: 220px;
          top: 0;
          left: 0;
        }

        .gm-page-loader-dot-1,
        .gm-page-loader-dot-2,
        .gm-page-loader-dot-3 {
          position: absolute;
          border-radius: 999px;
          animation-fill-mode: both;
          animation-iteration-count: infinite;
          animation-direction: alternate;
          animation-timing-function: cubic-bezier(0.21, 0.98, 0.6, 0.99);
        }

        .gm-page-loader-dot-1 {
          z-index: 3;
          width: 30px;
          height: 30px;
          top: 95px;
          left: 95px;
          background: #ffffff;
          animation-name: gm-page-loader-jump-1;
          animation-duration: 2s;
        }

        .gm-page-loader-dot-2 {
          z-index: 2;
          width: 60px;
          height: 60px;
          top: 80px;
          left: 80px;
          background: #f0be00;
          animation-name: gm-page-loader-jump-2;
          animation-duration: 2s;
        }

        .gm-page-loader-dot-3 {
          z-index: 1;
          width: 90px;
          height: 90px;
          top: 65px;
          left: 65px;
          background: #d33100;
          animation-name: gm-page-loader-jump-3;
          animation-duration: 2s;
        }

        .gm-page-loader-text {
          position: absolute;
          bottom: -36px;
          width: 100%;
          text-align: center;
          color: #7d1717;
          font-size: 0.95rem;
          font-weight: 700;
        }

        @keyframes gm-page-loader-jump-1 {
          0%, 70% {
            box-shadow: 2px 2px 3px 2px rgba(0, 0, 0, 0.18);
            transform: scale(0);
          }
          100% {
            box-shadow: 10px 10px 15px 0 rgba(0, 0, 0, 0.28);
            transform: scale(1);
          }
        }

        @keyframes gm-page-loader-jump-2 {
          0%, 40% {
            box-shadow: 2px 2px 3px 2px rgba(0, 0, 0, 0.18);
            transform: scale(0);
          }
          100% {
            box-shadow: 10px 10px 15px 0 rgba(0, 0, 0, 0.28);
            transform: scale(1);
          }
        }

        @keyframes gm-page-loader-jump-3 {
          0%, 10% {
            box-shadow: 2px 2px 3px 2px rgba(0, 0, 0, 0.18);
            transform: scale(0);
          }
          100% {
            box-shadow: 10px 10px 15px 0 rgba(0, 0, 0, 0.28);
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
