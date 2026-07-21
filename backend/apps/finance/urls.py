from django.urls import path

from . import views

urlpatterns = [
    path("summary/", views.summary, name="finance-summary"),
    path("sales-over-time/", views.sales_over_time, name="finance-sales-over-time"),
    path("top-products/", views.top_products, name="finance-top-products"),
    path("stock-value/", views.stock_value, name="finance-stock-value"),
    path("sales-report/export/", views.sales_report_csv, name="finance-csv"),
]
