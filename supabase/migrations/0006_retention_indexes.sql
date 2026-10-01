begin;
create index request_budgets_expiry on request_budgets(window_start);
commit;
