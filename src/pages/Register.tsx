import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Register = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/");
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-accent p-4">
      <div className="w-full max-w-md space-y-8 bg-background/80 backdrop-blur-sm p-8 rounded-lg shadow-xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-primary">Create an Account</h2>
          <p className="mt-2 text-muted-foreground">Sign up to get started</p>
        </div>
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          theme="light"
          providers={[]}
          view="sign_up"
        />
      </div>
    </div>
  );
};

export default Register;