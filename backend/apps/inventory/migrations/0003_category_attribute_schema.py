from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0002_brand_category'),
    ]

    operations = [
        migrations.AddField(
            model_name='category',
            name='attribute_schema',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
