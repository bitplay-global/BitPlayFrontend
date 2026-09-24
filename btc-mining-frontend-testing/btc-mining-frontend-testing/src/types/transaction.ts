export interface Transaction {
  type: string;
  method: string;
  date: string;
  amount: string;
  amountNumeric?: { $numberDecimal: string }| number;
  isPositive: boolean;
  status?: string;
}
