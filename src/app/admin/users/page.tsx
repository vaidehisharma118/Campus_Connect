"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function ManageUsersPage() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [promotingId, setPromotingId] = useState(null);

  const loadProfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, email, role")
      .order("role", { ascending: true });

    if (!error) setProfiles(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const handlePromote = async (targetId) => {
    setPromotingId(targetId);

    // The server (Postgres function) re-checks that WE are an admin
    // before it will promote anyone -- this button being visible only
    // to admins is a UI nicety, not the actual security boundary.
    const { error } = await supabase.rpc("promote_to_admin", {
      p_target_id: targetId,
    });

    if (error) {
      alert(error.message);
    } else {
      await loadProfiles();
    }
    setPromotingId(null);
  };

  return (
    <div className="min-h-screen bg-blue-50 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-3xl font-bold text-center text-blue-700 mb-8">
          Manage Users
        </h1>

        {loading ? (
          <p className="text-center text-gray-500">Loading users...</p>
        ) : (
          <div className="space-y-3">
            {profiles.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between border border-gray-200 rounded-lg p-4"
              >
                <div>
                  <p className="font-medium text-gray-800">
                    {p.name || p.email || p.id}
                  </p>
                  <p className="text-sm text-gray-500 capitalize">{p.role}</p>
                </div>

                {p.role === "admin" ? (
                  <span className="text-sm font-semibold text-blue-600">
                    Admin
                  </span>
                ) : (
                  <button
                    onClick={() => handlePromote(p.id)}
                    disabled={promotingId === p.id}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition duration-200"
                  >
                    {promotingId === p.id ? "Promoting..." : "Make Admin"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
