from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0005_stockwarranty'),
    ]

    operations = [
        migrations.AddConstraint(
            model_name='product',
            constraint=models.CheckConstraint(
                check=models.Q(('purchase_price__isnull', True), ('purchase_price__gte', 0), _connector='OR'),
                name='product_purchase_price_non_negative',
            ),
        ),
        migrations.AddConstraint(
            model_name='product',
            constraint=models.CheckConstraint(
                check=models.Q(('cost_price__isnull', True), ('cost_price__gte', 0), _connector='OR'),
                name='product_cost_price_non_negative',
            ),
        ),
        migrations.AddConstraint(
            model_name='product',
            constraint=models.CheckConstraint(
                check=models.Q(('selling_price__isnull', True), ('selling_price__gte', 0), _connector='OR'),
                name='product_selling_price_non_negative',
            ),
        ),
        migrations.AddConstraint(
            model_name='sku',
            constraint=models.CheckConstraint(
                check=models.Q(('sell_price__gt', 0)),
                name='sku_sell_price_positive',
            ),
        ),
        migrations.AddConstraint(
            model_name='stockunit',
            constraint=models.CheckConstraint(
                check=models.Q(('purchase_cost__gt', 0)),
                name='stockunit_purchase_cost_positive',
            ),
        ),
    ]
