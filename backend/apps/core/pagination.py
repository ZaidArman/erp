from rest_framework.pagination import PageNumberPagination


class StandardPagination(PageNumberPagination):
    """Default pagination for every list endpoint: 50/page, overridable via
    ?page_size= (capped at 200) so the frontend's table controls can offer a
    page-size picker everywhere, not just on the Products report."""

    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200
