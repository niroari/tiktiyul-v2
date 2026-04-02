export type NavItem = {
  label: string;
  href: string;
  letter?: string; // Hebrew letter for appendices
  icon?: string;   // icon name for general sections
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

export function getTripNav(tripId: string): NavGroup[] {
  const base = `/trips/${tripId}`;
  return [
    {
      title: "כללי",
      items: [
        { label: "דשבורד", href: `${base}`, icon: "dashboard" },
        { label: "רשימת תלמידים", href: `${base}/students`, icon: "students" },
        { label: "צוות הטיול", href: `${base}/staff`, icon: "staff" },
      ],
    },
    {
      title: "נספחים",
      items: [
        { label: "בדיקה לפני יציאה", href: `${base}/appendix/alef`, letter: "א" },
        { label: "אישור מנהל ורכז", href: `${base}/appendix/bet`, letter: "ב" },
        { label: "כתב מינוי", href: `${base}/appendix/gimel`, letter: "ג" },
        { label: "לוח זמנים", href: `${base}/appendix/dalet`, letter: "ד" },
        { label: "טלפונים חיוניים", href: `${base}/appendix/hey`, letter: "ה" },
        { label: "טבלת שליטה", href: `${base}/appendix/vav`, letter: "ו" },
        { label: "רשימת תלמידים", href: `${base}/appendix/zayin`, letter: "ז" },
        { label: "אישור הורים", href: `${base}/appendix/chet`, letter: "ח" },
        { label: "ציוד חובה", href: `${base}/appendix/tet`, letter: "ט" },
        { label: "מגבלות רפואיות", href: `${base}/appendix/yod`, letter: "י" },
      ],
    },
    {
      title: "מיוחד",
      items: [
        { label: "העדפות מזון", href: `${base}/food`, icon: "food" },
        { label: "חלוקת חדרים", href: `${base}/rooms`, icon: "rooms" },
        { label: "הודעת מסע", href: `${base}/masa`, icon: "masa" },
        { label: "שילוט אוטובוסים", href: `${base}/signs`, icon: "signs" },
        { label: "אישור ביטחוני", href: `${base}/security`, icon: "security" },
      ],
    },
  ];
}
