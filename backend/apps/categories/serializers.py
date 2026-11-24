from rest_framework import serializers

from .models import Category


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "kind", "parent", "icon", "color", "is_archived", "created_at"]
        read_only_fields = ["id", "created_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            self.fields["parent"].queryset = Category.objects.filter(user=request.user)

    def validate(self, attrs):
        user = self.context["request"].user
        kind = attrs.get("kind", getattr(self.instance, "kind", None))
        name = attrs.get("name", getattr(self.instance, "name", None))
        parent = attrs.get("parent", getattr(self.instance, "parent", None))

        if parent is not None:
            if parent.kind != kind:
                raise serializers.ValidationError({"parent": "Parent must be the same kind."})
            if self.instance and parent.pk == self.instance.pk:
                raise serializers.ValidationError({"parent": "A category cannot be its own parent."})

        qs = Category.objects.filter(user=user, kind=kind, name__iexact=name)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError({"name": "This category already exists."})

        if self.instance and "kind" in attrs and attrs["kind"] != self.instance.kind:
            if self.instance.transactions.exists():
                raise serializers.ValidationError(
                    {"kind": "Cannot change the kind of a category that has transactions."}
                )
        return attrs
