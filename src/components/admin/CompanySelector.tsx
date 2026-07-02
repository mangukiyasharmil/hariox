import { Building2, ChevronDown, Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useCompany } from "@/contexts/CompanyContext";

const CompanySelector = () => {
  const { companies, currentCompany, setCurrentCompany, isLoading, showAllCompanies, setShowAllCompanies, isAdmin } = useCompany();

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs sm:text-sm font-medium bg-muted rounded-lg">
        <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
        <span className="truncate max-w-[80px] sm:max-w-none">Loading...</span>
      </div>
    );
  }

  // Show selector if there are multiple companies (need All Companies option)
  const displayName = showAllCompanies ? "All Companies" : (currentCompany?.name || "Company");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3">
          {showAllCompanies ? (
            <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 text-amber-500" />
          ) : (
            <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
          )}
          <span className="truncate max-w-[60px] sm:max-w-[120px] text-xs sm:text-sm">
            {displayName}
          </span>
          <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {/* All Companies Option - Admin Only */}
        {isAdmin && (
          <>
            <DropdownMenuItem
              onClick={() => setShowAllCompanies(true)}
              className={showAllCompanies ? "bg-amber-50 text-amber-700" : ""}
            >
              <Globe className="w-4 h-4 mr-2 flex-shrink-0 text-amber-500" />
              <div className="flex flex-col">
                <span className="font-medium">All Companies</span>
                <span className="text-xs text-muted-foreground">View leads from all</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        
        {/* Individual Companies */}
        {companies.map((company) => (
          <DropdownMenuItem
            key={company.id}
            onClick={() => {
              setCurrentCompany(company);
              setShowAllCompanies(false);
            }}
            className={!showAllCompanies && currentCompany?.id === company.id ? "bg-accent" : ""}
          >
            <Building2 className="w-4 h-4 mr-2 flex-shrink-0" />
            <span className="truncate">{company.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default CompanySelector;
