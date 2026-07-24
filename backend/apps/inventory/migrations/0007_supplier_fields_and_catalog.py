import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('inventory', '0006_price_check_constraints'),
    ]

    operations = [
        migrations.AddField(
            model_name='supplier',
            name='code',
            field=models.CharField(blank=True, default='', max_length=50),
        ),
        migrations.AddField(
            model_name='supplier',
            name='phone',
            field=models.CharField(blank=True, default='', max_length=32),
        ),
        migrations.AddField(
            model_name='supplier',
            name='email',
            field=models.EmailField(blank=True, default='', max_length=254),
        ),
        migrations.AddField(
            model_name='supplier',
            name='city',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AddField(
            model_name='supplier',
            name='country',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AddField(
            model_name='supplier',
            name='address',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='supplier',
            name='license_no',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AddField(
            model_name='supplier',
            name='tax_no',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AddField(
            model_name='supplier',
            name='ntn',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AddField(
            model_name='supplier',
            name='bank_account',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AddField(
            model_name='supplier',
            name='payment_terms',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='supplier',
            name='credit_limit',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name='supplier',
            name='is_active',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='supplier',
            name='deleted_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='supplier',
            name='deleted_by',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='+', to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.CreateModel(
            name='SupplierCatalogItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('supplier_cost', models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ('notes', models.CharField(blank=True, default='', max_length=255)),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='supplier_catalog_items', to='inventory.product')),
                ('supplier', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='catalog_items', to='inventory.supplier')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='%(class)s_set', to='tenants.tenant')),
            ],
            options={
                'ordering': ['-created_at'],
                'unique_together': {('tenant', 'supplier', 'product')},
            },
        ),
    ]
