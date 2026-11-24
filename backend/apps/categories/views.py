from apps.core.viewsets import AuditedModelViewSet

from .models import Category
from .serializers import CategorySerializer


class CategoryViewSet(AuditedModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    filterset_fields = ["kind", "is_archived", "parent"]
    search_fields = ["name"]
    ordering_fields = ["name", "kind"]
    pagination_class = None
