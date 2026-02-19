"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FraudRing } from "@/lib/types";

interface FraudRingTableProps {
  rings: FraudRing[];
}

function patternLabel(type: string): string {
  switch (type) {
    case "cycle":
      return "Circular Routing";
    case "fan_in":
      return "Fan-In (Smurfing)";
    case "fan_out":
      return "Fan-Out (Smurfing)";
    case "smurfing":
      return "Smurfing";
    case "shell_network":
      return "Shell Network";
    default:
      return type;
  }
}

function riskColor(score: number): string {
  if (score >= 80) return "text-red-400";
  if (score >= 60) return "text-orange-400";
  if (score >= 40) return "text-yellow-400";
  return "text-green-400";
}

function riskBadgeVariant(
  score: number
): "default" | "secondary" | "destructive" | "outline" {
  if (score >= 80) return "destructive";
  if (score >= 50) return "default";
  return "secondary";
}

export function FraudRingTable({ rings }: FraudRingTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Fraud Ring Summary ({rings.length} ring{rings.length !== 1 ? "s" : ""}{" "}
          detected)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ring ID</TableHead>
                <TableHead>Pattern Type</TableHead>
                <TableHead className="text-center">Member Count</TableHead>
                <TableHead className="text-center">Risk Score</TableHead>
                <TableHead>Member Account IDs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rings.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground py-8"
                  >
                    No fraud rings detected
                  </TableCell>
                </TableRow>
              ) : (
                rings.map((ring) => (
                  <TableRow key={ring.ring_id}>
                    <TableCell className="font-mono font-medium">
                      {ring.ring_id}
                    </TableCell>
                    <TableCell>
                      <Badge variant={riskBadgeVariant(ring.risk_score)}>
                        {patternLabel(ring.pattern_type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {ring.member_accounts.length}
                    </TableCell>
                    <TableCell
                      className={`text-center font-bold ${riskColor(
                        ring.risk_score
                      )}`}
                    >
                      {ring.risk_score}
                    </TableCell>
                    <TableCell className="font-mono text-xs max-w-md">
                      <div className="truncate">
                        {ring.member_accounts.join(", ")}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
