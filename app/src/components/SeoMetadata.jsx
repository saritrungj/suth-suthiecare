import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const SITE_NAME = "SUTHie Care - สุดที่แคร์";
const DEFAULT_TITLE = `${SITE_NAME} | เพราะเราแคร์คุณที่สุด`;
const DEFAULT_DESCRIPTION =
  "SUTHie Care - สุดที่แคร์ ศูนย์รวมบริการสุขภาพออนไลน์จากโรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี ลงทะเบียนขอรับคำปรึกษา ทำแบบประเมิน และติดตามผลสุขภาพได้ง่าย เพราะเราแคร์คุณที่สุด";

const PRIVATE_PATHS = [
  "/admin",
  "/login",
  "/account",
  "/history",
  "/clinic-detail",
  "/assessment-result",
];

function getPageMetadata(pathname) {
  if (pathname === "/help-center") {
    return {
      title: `ศูนย์ช่วยเหลือ | ${SITE_NAME}`,
      description:
        "ค้นหาข้อมูลบริการ ขั้นตอนการเข้ารับคำปรึกษา และคำตอบที่เป็นประโยชน์จาก SUTHie Care - สุดที่แคร์",
    };
  }

  if (pathname.startsWith("/help-center/clinic/")) {
    return {
      title: `ข้อมูลคลินิกและบริการ | ${SITE_NAME}`,
      description:
        "รายละเอียดคลินิก บริการสุขภาพ และขั้นตอนการเข้ารับคำปรึกษาจากโรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี",
    };
  }

  if (pathname.startsWith("/assessment/")) {
    return {
      title: `แบบประเมินสุขภาพ | ${SITE_NAME}`,
      description:
        "ทำแบบประเมินสุขภาพออนไลน์กับ SUTHie Care เพื่อรับคำแนะนำเบื้องต้นและเข้าถึงบริการที่เหมาะกับคุณ",
    };
  }

  return { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION };
}

function setMeta(selector, attribute, value) {
  const element = document.head.querySelector(selector);
  if (element) element.setAttribute(attribute, value);
}

export default function SeoMetadata() {
  const { pathname } = useLocation();

  useEffect(() => {
    const { title, description } = getPageMetadata(pathname);
    const isPrivate = PRIVATE_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    );
    const canonicalPath = pathname === "/" ? "/" : pathname.replace(/\/$/, "");
    const canonicalUrl = new URL(canonicalPath, window.location.origin).href;

    document.title = title;
    setMeta('meta[name="description"]', "content", description);
    setMeta(
      'meta[name="robots"]',
      "content",
      isPrivate
        ? "noindex, nofollow, noarchive"
        : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
    );
    setMeta('meta[property="og:title"]', "content", title);
    setMeta('meta[property="og:description"]', "content", description);
    setMeta('meta[name="twitter:title"]', "content", title);
    setMeta('meta[name="twitter:description"]', "content", description);
    setMeta(
      'meta[property="og:image"]',
      "content",
      new URL("/logo512.png", window.location.origin).href,
    );
    setMeta(
      'meta[name="twitter:image"]',
      "content",
      new URL("/logo512.png", window.location.origin).href,
    );

    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;

    let ogUrl = document.head.querySelector('meta[property="og:url"]');
    if (!ogUrl) {
      ogUrl = document.createElement("meta");
      ogUrl.setAttribute("property", "og:url");
      document.head.appendChild(ogUrl);
    }
    ogUrl.setAttribute("content", canonicalUrl);

    let structuredData = document.head.querySelector(
      'script[data-seo-structured-data="suthie-care"]',
    );
    if (pathname === "/") {
      if (!structuredData) {
        structuredData = document.createElement("script");
        structuredData.type = "application/ld+json";
        structuredData.dataset.seoStructuredData = "suthie-care";
        document.head.appendChild(structuredData);
      }
      structuredData.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "WebSite",
            "@id": `${window.location.origin}/#website`,
            url: `${window.location.origin}/`,
            name: SITE_NAME,
            alternateName: "สุดที่แคร์",
            description: DEFAULT_DESCRIPTION,
            inLanguage: "th-TH",
            publisher: { "@id": `${window.location.origin}/#organization` },
          },
          {
            "@type": "MedicalOrganization",
            "@id": `${window.location.origin}/#organization`,
            name: "โรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี",
            alternateName: "SUTH",
            url: `${window.location.origin}/`,
            logo: new URL("/logo512.png", window.location.origin).href,
            slogan: "เพราะเราแคร์คุณที่สุด",
          },
        ],
      });
    } else {
      structuredData?.remove();
    }
  }, [pathname]);

  return null;
}
