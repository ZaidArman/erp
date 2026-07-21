from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import EmployeePermission, User


@receiver(post_save, sender=User)
def create_employee_permission(sender, instance, created, **kwargs):
    if created and instance.role == User.ROLE_EMPLOYEE:
        EmployeePermission.objects.get_or_create(user=instance)
