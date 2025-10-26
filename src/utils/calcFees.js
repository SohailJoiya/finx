exports.calculateWithdrawalFee = (requestAmount, userBalance) => {
  const eighty = userBalance * 0.8;
  const isOver = requestAmount > eighty;
  const rate = isOver ? 0.20 : 0.06;
  const fee = Number((requestAmount * rate).toFixed(8));
  const receivable = Number((requestAmount - fee).toFixed(8));
  return { fee, receivable, rate, isOver };
};