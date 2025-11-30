import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const location = useLocation();

    useEffect(() => {
        const checkAdminSession = () => {
            const sessionData = localStorage.getItem("adminSession");

            if (!sessionData) {
                setIsAdmin(false);
                setLoading(false);
                return;
            }

            try {
                const session = JSON.parse(sessionData);
                const loginTime = new Date(session.loginTime);
                const now = new Date();
                const hoursSinceLogin = (now.getTime() - loginTime.getTime()) / (1000 * 60 * 60);

                // Session expires after 8 hours
                if (hoursSinceLogin > 8) {
                    localStorage.removeItem("adminSession");
                    setIsAdmin(false);
                } else {
                    setIsAdmin(true);
                }
            } catch (err) {
                localStorage.removeItem("adminSession");
                setIsAdmin(false);
            }

            setLoading(false);
        };

        checkAdminSession();
    }, []);

    if (loading) return null;
    if (!isAdmin) return <Navigate to="/admin/login" state={{ from: location }} replace />;
    return <>{children}</>;
}
