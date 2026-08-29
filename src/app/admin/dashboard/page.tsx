"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AdminDashboard() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUser(user);

      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      // Belt-and-suspenders: middleware already blocks non-admins from
      // ever reaching this route server-side, but if role somehow isn't
      // admin (e.g. stale client state), bounce to the student dashboard
      // instead of rendering admin-only content.
      if (error) {
     console.log(error.message);
     return;
     }
      
      if (profileData?.role !== "admin") {
        router.push("/dashboard");
        return;
      }

      setProfile(profileData);
    };

    loadUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const adminActions = [
    {
      href: "/admin/notices/create",
      emoji: "📢",
      title: "Create Notice",
      desc: "Publish a new notice to the board.",
    },
    {
      href: "/admin/users",
      emoji: "🧑\u200d🤝\u200d🧑",
      title: "Manage Users",
      desc: "Promote students to admin.",
    },
    {
      href: "/events/create",
      emoji: "📅",
      title: "Create Event",
      desc: "Set up a new campus event.",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-sky-100 to-indigo-200 p-8">
      {/* Header */}
      <div className="max-w-5xl mx-auto flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-blue-700">
            Campus Connect
          </h1>
          <p className="text-gray-600 mt-1">Admin dashboard</p>
        </div>

        <button
          onClick={handleLogout}
          className="bg-red-500 hover:bg-red-600 text-white px-5 py-2 rounded-xl shadow transition"
        >
          Logout
        </button>
      </div>

      {/* Main Card */}
      <div className="max-w-5xl mx-auto bg-white/70 backdrop-blur-xl border border-blue-100 rounded-3xl shadow-2xl p-8">
        <h2 className="text-2xl font-bold text-blue-700 mb-6">
          Profile Information
        </h2>

        {user && (
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-blue-50 rounded-2xl p-6 shadow">
              <p className="text-sm text-gray-500 mb-2">Email</p>
              <p className="font-semibold text-gray-800 break-all">
                {user.email}
              </p>
            </div>

            <div className="bg-blue-50 rounded-2xl p-6 shadow">
              <p className="text-sm text-gray-500 mb-2">Name</p>
              <p className="font-semibold text-gray-800">
                {profile ? profile.name : "Loading..."}
              </p>
            </div>

            <div className="bg-blue-50 rounded-2xl p-6 shadow">
              <p className="text-sm text-gray-500 mb-2">Role</p>
              <p className="font-semibold text-gray-800 capitalize">
                {profile ? profile.role : "Loading..."}
              </p>
            </div>
          </div>
        )}

        {/* Admin Actions */}
        <div className="mt-10 border-t pt-8">
          <h3 className="text-xl font-semibold text-blue-700 mb-4">
            Admin Actions
          </h3>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {adminActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="bg-white rounded-xl p-5 shadow hover:shadow-lg transition cursor-pointer block"
              >
                <h4 className="font-semibold text-lg">
                  {action.emoji} {action.title}
                </h4>
                <p className="text-gray-500 text-sm mt-2">{action.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
