import { useState, useEffect } from "react";
import { Bell, BellOff, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const PushNotificationSettings = () => {
  const {
    isSupported,
    permission,
    isLoading,
    requestPermission,
    showNotification,
  } = usePushNotifications();

  const handleEnableNotifications = async () => {
    const granted = await requestPermission();
    if (granted) {
      // Show a test notification
      setTimeout(() => {
        showNotification("Notifications Enabled! 🎉", {
          body: "You'll now receive follow-up reminders for your leads.",
        });
      }, 1000);
    }
  };

  const getStatusBadge = () => {
    if (!isSupported) {
      return <Badge variant="destructive">Not Supported</Badge>;
    }
    switch (permission) {
      case "granted":
        return <Badge className="bg-emerald-100 text-emerald-800"><Check className="w-3 h-3 mr-1" />Enabled</Badge>;
      case "denied":
        return <Badge variant="destructive">Blocked</Badge>;
      default:
        return <Badge variant="outline">Not Enabled</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Push Notifications</CardTitle>
              <CardDescription>Get reminded about lead follow-ups</CardDescription>
            </div>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Enable push notifications to receive timely reminders for scheduled follow-ups 
          with your leads. Never miss an important call again!
        </p>
        
        <div className="flex flex-col sm:flex-row gap-3">
          {permission !== "granted" && isSupported && (
            <Button 
              onClick={handleEnableNotifications}
              disabled={isLoading || permission === "denied"}
              className="gap-2"
            >
              <Bell className="w-4 h-4" />
              {isLoading ? "Enabling..." : "Enable Notifications"}
            </Button>
          )}
          
          {permission === "granted" && (
            <Button
              variant="outline"
              onClick={() => showNotification("Test Notification", {
                body: "This is a test notification from Credit Hariox Admin",
              })}
            >
              Send Test Notification
            </Button>
          )}
          
          {permission === "denied" && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              <p className="font-medium">Notifications are blocked</p>
              <p className="text-xs mt-1">
                Please enable notifications in your browser settings to receive follow-up reminders.
              </p>
            </div>
          )}
        </div>

        {permission === "granted" && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg text-sm">
            <p className="text-emerald-800 dark:text-emerald-200 font-medium flex items-center gap-2">
              <Check className="w-4 h-4" />
              Notifications are enabled
            </p>
            <p className="text-emerald-600 dark:text-emerald-400 text-xs mt-1">
              You'll receive reminders when it's time to follow up with leads.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PushNotificationSettings;