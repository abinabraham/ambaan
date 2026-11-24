from .models import Category

DEFAULT_CATEGORIES = {
    Category.Kind.INCOME: [
        ("Salary", "#52c41a"),
        ("Business", "#13c2c2"),
        ("Freelance", "#2f54eb"),
        ("Investments", "#722ed1"),
        ("Gifts", "#eb2f96"),
        ("Other income", "#8c8c8c"),
    ],
    Category.Kind.EXPENSE: [
        ("Rent & Housing", "#f5222d"),
        ("Groceries", "#fa8c16"),
        ("Dining out", "#faad14"),
        ("Transport", "#1677ff"),
        ("Utilities", "#13c2c2"),
        ("Health", "#eb2f96"),
        ("Education", "#722ed1"),
        ("Shopping", "#fa541c"),
        ("Entertainment", "#a0d911"),
        ("Travel", "#2f54eb"),
        ("Insurance", "#597ef7"),
        ("Family support", "#9254de"),
        ("Subscriptions", "#36cfc9"),
        ("Other expenses", "#8c8c8c"),
    ],
}


def create_default_categories(user):
    Category.objects.bulk_create(
        [
            Category(user=user, kind=kind, name=name, color=color)
            for kind, items in DEFAULT_CATEGORIES.items()
            for name, color in items
        ],
        ignore_conflicts=True,
    )
