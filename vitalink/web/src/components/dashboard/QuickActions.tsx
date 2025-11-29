import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Activity, Pill, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";

const QuickActions = () => {
  const navigate = useNavigate();
  return (
    <Card className="p-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-foreground">Quick Actions</h2>
        <p className="text-sm text-muted-foreground">Common tasks</p>
      </div>
  
      <div className="space-y-3">
        <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/self-check")}> 
          <Plus className="w-4 h-4 mr-2" />
          Capture Blood Pressure
        </Button>
        <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/self-check")}> 
          <Activity className="w-4 h-4 mr-2" />
          Record Symptoms
        </Button>
        <Button className="w-full justify-start" variant="outline" disabled>
          <Pill className="w-4 h-4 mr-2" />
          View Medications
        </Button>
        <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/education")}> 
          <BookOpen className="w-4 h-4 mr-2" />
          Educational Content
        </Button>
      </div>
    </Card>
  );
};

export default QuickActions;
